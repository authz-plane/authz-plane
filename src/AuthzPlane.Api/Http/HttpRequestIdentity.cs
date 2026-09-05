using System.Diagnostics;
using AuthzPlane.Application.Abstractions;

namespace AuthzPlane.Api.Http;

/// <summary>
/// Who is calling. Day 2 has no authentication yet, so the actor is taken from
/// an <c>X-Actor</c> header when present and otherwise is a fixed development
/// identity. Day 8 replaces this with the validated JWT <c>sub</c>; nothing
/// downstream changes because they only see <see cref="ICurrentUser"/>.
/// </summary>
public sealed class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public const string ActorHeader = "X-Actor";
    public const string DevelopmentActor = "dev:operator";

    public string Id
    {
        get
        {
            var header = accessor.HttpContext?.Request.Headers[ActorHeader].ToString();
            return string.IsNullOrWhiteSpace(header) ? DevelopmentActor : header.Trim();
        }
    }

    public bool IsSystem => false;
}

/// <summary>Correlation for audit rows: ASP.NET's per-request id and the W3C trace id.</summary>
public sealed class HttpRequestContext(IHttpContextAccessor accessor) : IRequestContext
{
    public string? RequestId => accessor.HttpContext?.TraceIdentifier;

    public string? TraceId => Activity.Current?.TraceId.ToString();
}
