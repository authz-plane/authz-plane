namespace AuthzPlane.Infrastructure.Idempotency;

/// <summary>Persistence for <see cref="IdempotencyRecord"/>. Consumed by the API middleware.</summary>
public interface IIdempotencyStore
{
    /// <summary>Live record for the pair, or null when absent or expired.</summary>
    Task<IdempotencyRecord?> FindAsync(string actor, string key, CancellationToken cancellationToken = default);

    /// <summary>
    /// Stores a completed response. Runs in its own save after the handler's
    /// transaction committed; if two identical requests race, the first writer
    /// wins and the second is dropped silently, since both produced the same
    /// outcome.
    /// </summary>
    Task StoreAsync(IdempotencyRecord record, CancellationToken cancellationToken = default);
}
