namespace AuthzPlane.Application.Abstractions;

/// <summary>
/// Correlation for the current unit of work. Stamped onto audit rows so an
/// operator can walk from an audit event to the trace that produced it.
/// </summary>
public interface IRequestContext
{
    /// <summary>Per-request id, or a worker-generated id for background work.</summary>
    string? RequestId { get; }

    /// <summary>W3C trace id when tracing is on.</summary>
    string? TraceId { get; }
}
