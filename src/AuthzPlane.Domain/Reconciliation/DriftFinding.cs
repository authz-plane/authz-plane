using AuthzPlane.Domain.Common;

namespace AuthzPlane.Domain.Reconciliation;

/// <summary>
/// A single field where actual state diverged from desired, found by periodic
/// resync rather than by one of our own writes.
/// </summary>
public sealed class DriftFinding : Entity, ITenantScoped
{
    private DriftFinding()
    {
    }

    private DriftFinding(
        Guid id,
        Guid tenantId,
        Guid runId,
        ResourceKind resourceKind,
        string resourceRef,
        string fieldPath,
        string? desiredValue,
        string? actualValue,
        DriftSeverity severity,
        DateTimeOffset detectedAt)
        : base(id)
    {
        TenantId = tenantId;
        RunId = runId;
        ResourceKind = resourceKind;
        ResourceRef = resourceRef;
        FieldPath = fieldPath;
        DesiredValue = desiredValue;
        ActualValue = actualValue;
        Severity = severity;
        DetectedAt = detectedAt;
    }

    public Guid TenantId { get; private set; }

    public Guid RunId { get; private set; }

    public ResourceKind ResourceKind { get; private set; }

    public string ResourceRef { get; private set; } = string.Empty;

    /// <summary>JSON path of the diverging field, e.g. <c>idp.config.issuer</c>.</summary>
    public string FieldPath { get; private set; } = string.Empty;

    public string? DesiredValue { get; private set; }

    public string? ActualValue { get; private set; }

    public DriftSeverity Severity { get; private set; }

    public DateTimeOffset DetectedAt { get; private set; }

    /// <summary>Null while open. The partial index covers exactly this case.</summary>
    public DateTimeOffset? ResolvedAt { get; private set; }

    public bool IsOpen => ResolvedAt is null;

    public static DriftFinding Detect(
        Guid id,
        Guid tenantId,
        Guid runId,
        ResourceKind resourceKind,
        string resourceRef,
        string fieldPath,
        string? desiredValue,
        string? actualValue,
        DriftSeverity severity,
        DateTimeOffset detectedAt)
    {
        if (tenantId == Guid.Empty)
        {
            throw new DomainException("Drift finding requires a tenant id.");
        }

        if (string.IsNullOrWhiteSpace(fieldPath))
        {
            throw new DomainException("Drift finding requires a field path.");
        }

        if (desiredValue == actualValue)
        {
            throw new DomainException(
                $"Field '{fieldPath}' has equal desired and actual values; that is not drift.");
        }

        return new DriftFinding(
            id, tenantId, runId, resourceKind, resourceRef, fieldPath,
            desiredValue, actualValue, severity, detectedAt);
    }

    public void Resolve(DateTimeOffset resolvedAt)
    {
        if (!IsOpen)
        {
            throw new DomainException($"Drift finding {Id} is already resolved.");
        }

        ResolvedAt = resolvedAt;
    }
}
