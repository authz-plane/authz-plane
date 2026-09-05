using System.Security.Cryptography;
using System.Text;
using AuthzPlane.Api.Http;
using AuthzPlane.Application.Abstractions;
using AuthzPlane.Infrastructure.Idempotency;

namespace AuthzPlane.Api.Middleware;

/// <summary>
/// Makes every mutation under <c>/v1</c> safe to retry.
/// </summary>
/// <remarks>
/// The client sends <c>Idempotency-Key</c>. The first request runs and its
/// response is stored against (actor, key). A repeat with the same body gets
/// the stored response back with <c>Idempotent-Replayed: true</c>. The same key
/// with a different body is rejected with 422, because the client is confused
/// and guessing which request it meant would be worse than refusing.
///
/// Storage happens after the handler's own transaction committed, in a separate
/// save. If that save fails the response was still correct; a retry simply
/// re-executes, and the handlers' own preconditions make that safe.
/// </remarks>
public sealed class IdempotencyMiddleware(RequestDelegate next)
{
    public const string HeaderName = "Idempotency-Key";
    public const string ReplayedHeader = "Idempotent-Replayed";

    public async Task InvokeAsync(
        HttpContext context, IIdempotencyStore store, ICurrentUser currentUser, IClock clock)
    {
        if (!AppliesTo(context.Request))
        {
            await next(context);
            return;
        }

        var key = context.Request.Headers[HeaderName].ToString().Trim();
        if (key.Length == 0)
        {
            await ProblemResults.Problem(
                StatusCodes.Status400BadRequest,
                "Idempotency-Key required",
                $"Every {context.Request.Method} under /v1 must carry an Idempotency-Key header so it can be retried safely.")
                .ExecuteAsync(context);
            return;
        }

        if (key.Length > IdempotencyRecord.KeyMaxLength)
        {
            await ProblemResults.Problem(
                StatusCodes.Status400BadRequest,
                "Idempotency-Key too long",
                $"Idempotency-Key must be at most {IdempotencyRecord.KeyMaxLength} characters.")
                .ExecuteAsync(context);
            return;
        }

        var requestHash = await HashRequestAsync(context.Request, context.RequestAborted);
        var actor = currentUser.Id;

        var existing = await store.FindAsync(actor, key, context.RequestAborted);
        if (existing is not null)
        {
            if (!string.Equals(existing.RequestHash, requestHash, StringComparison.Ordinal))
            {
                await ProblemResults.Problem(
                    StatusCodes.Status422UnprocessableEntity,
                    "Idempotency-Key reused",
                    "This Idempotency-Key was already used for a different request. Use a new key for a new request.")
                    .ExecuteAsync(context);
                return;
            }

            await ReplayAsync(context, existing);
            return;
        }

        var response = await CaptureAsync(context);

        // 5xx responses are not stored: the client should retry and get a real
        // answer, not a replay of our outage.
        if (context.Response.StatusCode < StatusCodes.Status500InternalServerError)
        {
            var body = response.Body is { Length: > 0 } && IsJson(response.ContentType) ? response.Body : null;
            var record = new IdempotencyRecord(
                actor, key, requestHash, context.Response.StatusCode, response.ContentType, body, clock.UtcNow);
            await store.StoreAsync(record, context.RequestAborted);
        }
    }

    private static bool AppliesTo(HttpRequest request) =>
        request.Path.StartsWithSegments("/v1") &&
        (HttpMethods.IsPost(request.Method) ||
         HttpMethods.IsPut(request.Method) ||
         HttpMethods.IsPatch(request.Method) ||
         HttpMethods.IsDelete(request.Method));

    private static async Task<string> HashRequestAsync(HttpRequest request, CancellationToken cancellationToken)
    {
        request.EnableBuffering();
        using var sha = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        sha.AppendData(Encoding.UTF8.GetBytes($"{request.Method} {request.Path}{request.QueryString}\n"));

        await request.Body.CopyToAsync(new HashStream(sha), cancellationToken);
        request.Body.Position = 0;

        return Convert.ToHexStringLower(sha.GetHashAndReset());
    }

    private static async Task ReplayAsync(HttpContext context, IdempotencyRecord record)
    {
        context.Response.StatusCode = record.StatusCode;
        context.Response.Headers[ReplayedHeader] = "true";
        if (record.ContentType is not null)
        {
            context.Response.ContentType = record.ContentType;
        }

        if (record.ResponseBody is not null)
        {
            await context.Response.WriteAsync(record.ResponseBody, context.RequestAborted);
        }
    }

    /// <summary>Runs the rest of the pipeline with the body buffered, then forwards it to the client.</summary>
    private async Task<(string? ContentType, string? Body)> CaptureAsync(HttpContext context)
    {
        var original = context.Response.Body;
        await using var buffer = new MemoryStream();
        context.Response.Body = buffer;

        try
        {
            await next(context);
        }
        finally
        {
            context.Response.Body = original;
        }

        buffer.Position = 0;
        var body = buffer.Length == 0 ? null : Encoding.UTF8.GetString(buffer.ToArray());
        buffer.Position = 0;
        await buffer.CopyToAsync(original, context.RequestAborted);

        return (context.Response.ContentType, body);
    }

    private static bool IsJson(string? contentType) =>
        contentType is not null && contentType.Contains("json", StringComparison.OrdinalIgnoreCase);

    /// <summary>Write-only stream that feeds an incremental hash, so bodies are never buffered twice.</summary>
    private sealed class HashStream(IncrementalHash hash) : Stream
    {
        public override bool CanRead => false;

        public override bool CanSeek => false;

        public override bool CanWrite => true;

        public override long Length => throw new NotSupportedException();

        public override long Position
        {
            get => throw new NotSupportedException();
            set => throw new NotSupportedException();
        }

        public override void Write(byte[] buffer, int offset, int count) => hash.AppendData(buffer, offset, count);

        public override void Write(ReadOnlySpan<byte> buffer) => hash.AppendData(buffer);

        public override void Flush()
        {
        }

        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();

        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();

        public override void SetLength(long value) => throw new NotSupportedException();
    }
}
