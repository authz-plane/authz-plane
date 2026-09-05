namespace AuthzPlane.Infrastructure.Idempotency;

/// <summary>
/// A stored response for one (actor, Idempotency-Key) pair. A repeat of the
/// same request replays the stored response; the same key with a different body
/// is rejected, because the client is confused and silently honouring either
/// interpretation would be wrong.
/// </summary>
/// <remarks>
/// Lives in Infrastructure, not Domain: this is an HTTP delivery concern with no
/// business meaning. Keyed per actor so one caller's key cannot replay
/// another's response.
/// </remarks>
public sealed class IdempotencyRecord
{
    public const int KeyMaxLength = 128;

    /// <summary>How long a key is honoured. Long enough for any sane client retry policy.</summary>
    public static readonly TimeSpan TimeToLive = TimeSpan.FromHours(24);

    private IdempotencyRecord()
    {
    }

    public IdempotencyRecord(
        string actor,
        string key,
        string requestHash,
        int statusCode,
        string? contentType,
        string? responseBody,
        DateTimeOffset createdAt)
    {
        Actor = actor;
        Key = key;
        RequestHash = requestHash;
        StatusCode = statusCode;
        ContentType = contentType;
        ResponseBody = responseBody;
        CreatedAt = createdAt;
        ExpiresAt = createdAt + TimeToLive;
    }

    public string Actor { get; private set; } = string.Empty;

    public string Key { get; private set; } = string.Empty;

    /// <summary>SHA-256 of method, path and body; detects key reuse with a different request.</summary>
    public string RequestHash { get; private set; } = string.Empty;

    public int StatusCode { get; private set; }

    public string? ContentType { get; private set; }

    public string? ResponseBody { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset ExpiresAt { get; private set; }

    public bool IsExpired(DateTimeOffset now) => ExpiresAt <= now;
}
