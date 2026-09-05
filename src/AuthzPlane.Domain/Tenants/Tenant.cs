using AuthzPlane.Domain.Common;

namespace AuthzPlane.Domain.Tenants;

/// <summary>
/// A tenant's <em>desired</em> state. Observed state lives in
/// <see cref="TenantStatus"/>, deliberately kept in a separate row.
/// </summary>
/// <remarks>
/// Deviation from system-design.md section 8.1: the ER diagram shows
/// <c>lifecycle_phase</c> on <c>tenants</c> as well as <c>phase</c> on
/// <c>tenant_status</c>. Only one copy is kept here, on the status row, because
/// two writable copies of the same fact reintroduce exactly the write-conflict
/// and audit problems that section 8.2 separates the tables to avoid. If a
/// denormalised phase is later needed for list queries, it should be a
/// projection, not a second source of truth.
/// </remarks>
public sealed class Tenant : Entity
{
    private Tenant()
    {
    }

    private Tenant(Guid id, TenantSlug slug, string displayName, DateTimeOffset createdAt)
        : base(id)
    {
        Slug = slug;
        DisplayName = displayName;
        Generation = Generation.None;
        CreatedAt = createdAt;
    }

    /// <summary>Immutable: it appears in external system names we cannot cheaply rename.</summary>
    public TenantSlug Slug { get; private set; }

    public string DisplayName { get; private set; } = string.Empty;

    /// <summary>Desired-state version. Bumped on every spec write.</summary>
    public Generation Generation { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? DeletedAt { get; private set; }

    public bool IsDeleted => DeletedAt is not null;

    public static Tenant Create(Guid id, TenantSlug slug, string displayName, DateTimeOffset createdAt)
    {
        if (string.IsNullOrWhiteSpace(displayName))
        {
            throw new DomainException("Tenant display name is required.");
        }

        return new Tenant(id, slug, displayName.Trim(), createdAt);
    }

    public void Rename(string displayName)
    {
        if (string.IsNullOrWhiteSpace(displayName))
        {
            throw new DomainException("Tenant display name is required.");
        }

        EnsureNotDeleted();
        DisplayName = displayName.Trim();
    }

    /// <summary>
    /// Advances desired-state version. Called once per spec write, inside the
    /// same transaction that appends the spec row and the outbox message.
    /// </summary>
    public Generation BumpGeneration()
    {
        EnsureNotDeleted();
        Generation = Generation.Next();
        return Generation;
    }

    public void MarkDeleted(DateTimeOffset deletedAt)
    {
        EnsureNotDeleted();
        DeletedAt = deletedAt;
    }

    private void EnsureNotDeleted()
    {
        if (IsDeleted)
        {
            throw new DomainException($"Tenant '{Slug}' is deleted and cannot be modified.");
        }
    }
}
