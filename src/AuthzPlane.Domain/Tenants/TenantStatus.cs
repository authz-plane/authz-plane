using AuthzPlane.Domain.Common;
using AuthzPlane.Domain.Reconciliation;

namespace AuthzPlane.Domain.Tenants;

/// <summary>
/// A tenant's <em>observed</em> state: one mutable row per tenant, written only
/// by the reconciler. Keyed by tenant id - there is no surrogate key, because
/// there is exactly one status per tenant.
/// </summary>
/// <remarks>
/// Every phase change goes through <see cref="TenantPhaseTransitions"/>. An
/// illegal transition throws rather than silently corrupting the lifecycle,
/// which means a reconciler bug surfaces as a failed run with a clear message
/// instead of a tenant wedged in an impossible state.
/// </remarks>
public sealed class TenantStatus : ITenantScoped
{
    private TenantStatus()
    {
    }

    private TenantStatus(Guid tenantId, DateTimeOffset createdAt)
    {
        TenantId = tenantId;
        Phase = TenantPhase.Pending;
        ObservedGeneration = Generation.None;
        LastTransitionAt = createdAt;
    }

    public Guid TenantId { get; private set; }

    public TenantPhase Phase { get; private set; }

    /// <summary>The generation the reconciler has actually converged to.</summary>
    public Generation ObservedGeneration { get; private set; }

    /// <summary>Hash of last-read external state; drives drift detection.</summary>
    public string? ActualStateHash { get; private set; }

    public string? LastError { get; private set; }

    public int ConsecutiveFailures { get; private set; }

    public DateTimeOffset? LastReconciledAt { get; private set; }

    /// <summary>When the next retry becomes eligible. Null when not waiting.</summary>
    public DateTimeOffset? NextAttemptAt { get; private set; }

    public DateTimeOffset LastTransitionAt { get; private set; }

    public static TenantStatus Create(Guid tenantId, DateTimeOffset createdAt)
    {
        if (tenantId == Guid.Empty)
        {
            throw new DomainException("Tenant status requires a tenant id.");
        }

        return new TenantStatus(tenantId, createdAt);
    }

    /// <summary>Converged: the reconciler has caught up with desired state.</summary>
    public bool IsConverged(Generation desired) =>
        Phase == TenantPhase.Ready && ObservedGeneration == desired;

    /// <summary>True when a retry is due. Null <c>NextAttemptAt</c> means "now".</summary>
    public bool IsRetryDue(DateTimeOffset now) =>
        NextAttemptAt is null || NextAttemptAt <= now;

    public void BeginPlanning(DateTimeOffset now)
    {
        Transition(TenantPhase.Planning, now);
        NextAttemptAt = null;
    }

    public void BeginApplying(DateTimeOffset now) => Transition(TenantPhase.Applying, now);

    public void MarkReady(Generation observed, string? actualStateHash, DateTimeOffset now)
    {
        Transition(TenantPhase.Ready, now);
        ObservedGeneration = observed;
        ActualStateHash = actualStateHash;
        LastError = null;
        ConsecutiveFailures = 0;
        NextAttemptAt = null;
        LastReconciledAt = now;
    }

    /// <summary>
    /// Records a failed run and schedules the retry. Jitter is supplied by the
    /// caller so the schedule stays deterministic under test.
    /// </summary>
    public void MarkDegraded(string error, DateTimeOffset now, double jitter = 0.5)
    {
        Transition(TenantPhase.Degraded, now);
        LastError = error;
        ConsecutiveFailures++;
        LastReconciledAt = now;
        NextAttemptAt = now + BackoffPolicy.DelayFor(ConsecutiveFailures, jitter);
    }

    /// <summary>Retry budget exhausted. Terminal until a human requests reconcile.</summary>
    public void MarkFailed(DateTimeOffset now)
    {
        if (!BackoffPolicy.IsExhausted(ConsecutiveFailures))
        {
            throw new DomainException(
                $"Tenant has {ConsecutiveFailures} failures; " +
                $"{BackoffPolicy.MaxAttempts} required before Failed.");
        }

        Transition(TenantPhase.Failed, now);
        NextAttemptAt = null;
    }

    public void BeginDeleting(DateTimeOffset now) => Transition(TenantPhase.Deleting, now);

    public void MarkDeleted(DateTimeOffset now)
    {
        Transition(TenantPhase.Deleted, now);
        NextAttemptAt = null;
    }

    private void Transition(TenantPhase to, DateTimeOffset now)
    {
        if (!TenantPhaseTransitions.IsLegal(Phase, to))
        {
            var legal = TenantPhaseTransitions.LegalFrom(Phase);
            var allowed = legal.Count == 0 ? "none (terminal)" : string.Join(", ", legal);
            throw new DomainException(
                $"Illegal tenant phase transition {Phase} -> {to}. Legal from {Phase}: {allowed}.");
        }

        Phase = to;
        LastTransitionAt = now;
    }
}
