using System.Text.Json;
using AuthzPlane.Domain.Common;

namespace AuthzPlane.Domain.Tenants;

/// <summary>
/// One immutable version of a tenant's desired state. Append-only: a git-like
/// history of intent, which is what makes "what did we intend at 14:32
/// yesterday" answerable.
/// </summary>
public sealed class TenantSpec : Entity, ITenantScoped
{
    private TenantSpec()
    {
    }

    private TenantSpec(
        Guid id,
        Guid tenantId,
        Generation generation,
        string specJson,
        SpecHash specHash,
        string createdBy,
        DateTimeOffset createdAt)
        : base(id)
    {
        TenantId = tenantId;
        Generation = generation;
        SpecJson = specJson;
        SpecHash = specHash;
        CreatedBy = createdBy;
        CreatedAt = createdAt;
    }

    public Guid TenantId { get; private set; }

    public Generation Generation { get; private set; }

    /// <summary>The spec document, stored as jsonb.</summary>
    public string SpecJson { get; private set; } = "{}";

    /// <summary>Hash of the canonical form. See <see cref="Tenants.SpecHash"/>.</summary>
    public SpecHash SpecHash { get; private set; }

    public string CreatedBy { get; private set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; private set; }

    public static TenantSpec Create(
        Guid id,
        Guid tenantId,
        Generation generation,
        JsonElement spec,
        string createdBy,
        DateTimeOffset createdAt)
    {
        if (tenantId == Guid.Empty)
        {
            throw new DomainException("Tenant spec requires a tenant id.");
        }

        if (generation < Generation.First)
        {
            throw new DomainException(
                $"Tenant spec generation must be at least {Generation.First}; got {generation}.");
        }

        if (string.IsNullOrWhiteSpace(createdBy))
        {
            throw new DomainException("Tenant spec requires an author.");
        }

        // Store the canonical form, so the persisted bytes and the hash agree.
        var canonical = Tenants.SpecHash.Canonicalise(spec);
        return new TenantSpec(
            id, tenantId, generation, canonical, Tenants.SpecHash.Of(spec), createdBy, createdAt);
    }

    /// <summary>True when the supplied spec would produce no change.</summary>
    public bool Matches(JsonElement candidate) => SpecHash == Tenants.SpecHash.Of(candidate);
}
