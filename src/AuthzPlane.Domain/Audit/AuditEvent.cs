using System.Text.Json;
using AuthzPlane.Domain.Common;

namespace AuthzPlane.Domain.Audit;

/// <summary>
/// One immutable row in the append-only audit log. Written in the same
/// transaction as the mutation it describes, by the EF save interceptor.
/// </summary>
/// <remarks>
/// There are no mutators on purpose. The database role that serves the API has
/// no UPDATE or DELETE grant on <c>audit_events</c>; this class mirrors that at
/// the type level so nobody writes a "fix up the audit row" code path.
/// </remarks>
public sealed class AuditEvent : Entity, ITenantScoped
{
    private AuditEvent()
    {
    }

    private AuditEvent(
        Guid id,
        Guid tenantId,
        string actor,
        string action,
        string resourceType,
        string resourceId,
        string? before,
        string? after,
        string? requestId,
        string? traceId,
        DateTimeOffset occurredAt)
        : base(id)
    {
        TenantId = tenantId;
        Actor = actor;
        Action = action;
        ResourceType = resourceType;
        ResourceId = resourceId;
        Before = before;
        After = after;
        RequestId = requestId;
        TraceId = traceId;
        OccurredAt = occurredAt;
    }

    public Guid TenantId { get; private set; }

    /// <summary>User subject id, or a worker identity such as <c>system:reconciler</c>.</summary>
    public string Actor { get; private set; } = string.Empty;

    /// <summary>Past-tense event name, e.g. <c>SpecUpdated</c>. See <see cref="AuditActions"/>.</summary>
    public string Action { get; private set; } = string.Empty;

    public string ResourceType { get; private set; } = string.Empty;

    public string ResourceId { get; private set; } = string.Empty;

    /// <summary>State before the mutation as jsonb; null for creates.</summary>
    public string? Before { get; private set; }

    /// <summary>State after the mutation as jsonb; null for deletes.</summary>
    public string? After { get; private set; }

    public string? RequestId { get; private set; }

    public string? TraceId { get; private set; }

    public DateTimeOffset OccurredAt { get; private set; }

    public static AuditEvent Record(
        Guid id,
        Guid tenantId,
        string actor,
        string action,
        string resourceType,
        string resourceId,
        JsonElement? before,
        JsonElement? after,
        DateTimeOffset occurredAt,
        string? requestId = null,
        string? traceId = null)
    {
        if (tenantId == Guid.Empty)
        {
            throw new DomainException("Audit event requires a tenant id.");
        }

        Require(actor, "actor");
        Require(action, "action");
        Require(resourceType, "resource type");
        Require(resourceId, "resource id");

        if (before is null && after is null)
        {
            throw new DomainException("Audit event needs a before state, an after state, or both.");
        }

        return new AuditEvent(
            id,
            tenantId,
            actor.Trim(),
            action,
            resourceType,
            resourceId,
            before?.GetRawText(),
            after?.GetRawText(),
            requestId,
            traceId,
            occurredAt);
    }

    private static void Require(string value, string name)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new DomainException($"Audit event requires an {name}.");
        }
    }
}
