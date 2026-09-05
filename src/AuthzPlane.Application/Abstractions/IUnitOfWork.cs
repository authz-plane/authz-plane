namespace AuthzPlane.Application.Abstractions;

/// <summary>
/// Commits the current transaction. The spec row, the generation bump, the
/// outbox message and the audit row must land atomically or not at all.
/// </summary>
public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
