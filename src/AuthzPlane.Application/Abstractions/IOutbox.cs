using AuthzPlane.Domain.Outbox;

namespace AuthzPlane.Application.Abstractions;

/// <summary>
/// Transactional outbox port. <see cref="Enqueue"/> only stages the row; it is
/// committed by the same <see cref="IUnitOfWork.SaveChangesAsync"/> as the state
/// change it announces. That co-commit is the whole point of the pattern.
/// </summary>
public interface IOutbox
{
    void Enqueue(OutboxMessage message);
}
