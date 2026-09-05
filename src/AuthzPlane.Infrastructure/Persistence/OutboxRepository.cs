using AuthzPlane.Application.Abstractions;
using AuthzPlane.Domain.Outbox;

namespace AuthzPlane.Infrastructure.Persistence;

/// <summary>
/// Stages outbox rows on the same DbContext as the business write, so the one
/// <c>SaveChanges</c> at the end of the handler commits both or neither.
/// </summary>
internal sealed class OutboxRepository(AuthzPlaneDbContext db) : IOutbox
{
    public void Enqueue(OutboxMessage message) => db.OutboxMessages.Add(message);
}
