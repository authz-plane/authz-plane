using AuthzPlane.Application.Abstractions;
using AuthzPlane.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AuthzPlane.Infrastructure.Idempotency;

internal sealed class IdempotencyStore(AuthzPlaneDbContext db, IClock clock) : IIdempotencyStore
{
    public async Task<IdempotencyRecord?> FindAsync(string actor, string key, CancellationToken cancellationToken = default)
    {
        var record = await db.IdempotencyRecords
            .FirstOrDefaultAsync(r => r.Actor == actor && r.Key == key, cancellationToken);

        return record is null || record.IsExpired(clock.UtcNow) ? null : record;
    }

    public async Task StoreAsync(IdempotencyRecord record, CancellationToken cancellationToken = default)
    {
        db.IdempotencyRecords.Add(record);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Primary-key collision: a concurrent identical request stored first.
            // Detach so the failed insert does not poison later saves on this context.
            db.Entry(record).State = EntityState.Detached;
        }
    }
}
