namespace AuthzPlane.Domain.Common;

/// <summary>
/// Base for entities with a surrogate identity. Equality is by <see cref="Id"/>
/// and concrete type, never by reference.
/// </summary>
public abstract class Entity
{
    public Guid Id { get; protected set; }

    protected Entity(Guid id)
    {
        if (id == Guid.Empty)
        {
            throw new DomainException($"{GetType().Name} requires a non-empty id.");
        }

        Id = id;
    }

    /// <summary>EF Core materialisation constructor.</summary>
    protected Entity()
    {
    }

    public override bool Equals(object? obj) =>
        obj is Entity other && other.GetType() == GetType() && other.Id == Id;

    public override int GetHashCode() => HashCode.Combine(GetType(), Id);
}
