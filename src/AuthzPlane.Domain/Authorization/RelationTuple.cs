using AuthzPlane.Domain.Common;

namespace AuthzPlane.Domain.Authorization;

/// <summary>
/// A ReBAC tuple: <c>user# relation @ object</c>.
/// </summary>
/// <remarks>
/// OpenFGA remains authoritative for <c>check</c>. This mirror exists so the
/// planner can diff desired against actual without a network round-trip per
/// tuple, and so a tenant's tuples are visible in the control-plane UI. The
/// mirror is not a cache of decisions - it is a record of intent.
/// </remarks>
public sealed class RelationTuple : Entity, ITenantScoped
{
    private RelationTuple()
    {
    }

    private RelationTuple(
        Guid id,
        Guid tenantId,
        string userRef,
        string relation,
        string objectRef,
        string? condition,
        DateTimeOffset createdAt)
        : base(id)
    {
        TenantId = tenantId;
        UserRef = userRef;
        Relation = relation;
        ObjectRef = objectRef;
        Condition = condition;
        CreatedAt = createdAt;
    }

    public Guid TenantId { get; private set; }

    /// <summary>Subject, e.g. <c>user:alice</c> or <c>group:eng#member</c>.</summary>
    public string UserRef { get; private set; } = string.Empty;

    public string Relation { get; private set; } = string.Empty;

    /// <summary>Object, e.g. <c>document:roadmap</c>.</summary>
    public string ObjectRef { get; private set; } = string.Empty;

    /// <summary>Optional ABAC condition, stored as jsonb.</summary>
    public string? Condition { get; private set; }

    /// <summary>OpenFGA write id, set once the tuple is confirmed written.</summary>
    public string? ExternalWriteId { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public bool IsWritten => ExternalWriteId is not null;

    public static RelationTuple Create(
        Guid id,
        Guid tenantId,
        string userRef,
        string relation,
        string objectRef,
        DateTimeOffset createdAt,
        string? condition = null)
    {
        if (tenantId == Guid.Empty)
        {
            throw new DomainException("Relation tuple requires a tenant id.");
        }

        Require(userRef, nameof(userRef));
        Require(relation, nameof(relation));
        Require(objectRef, nameof(objectRef));

        return new RelationTuple(id, tenantId, userRef, relation, objectRef, condition, createdAt);
    }

    /// <summary>Records the external write id after OpenFGA confirms the tuple.</summary>
    public void MarkWritten(string externalWriteId)
    {
        if (string.IsNullOrWhiteSpace(externalWriteId))
        {
            throw new DomainException("External write id is required.");
        }

        ExternalWriteId = externalWriteId;
    }

    private static void Require(string value, string name)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new DomainException($"Relation tuple requires {name}.");
        }
    }
}
