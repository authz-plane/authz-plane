namespace AuthzPlane.Domain.Tenants;

/// <summary>Observed lifecycle phase of a tenant. See system-design.md section 7.3.</summary>
public enum TenantPhase
{
    /// <summary>Created, never reconciled.</summary>
    Pending = 0,

    /// <summary>A reconcile run has the lock and is computing a plan.</summary>
    Planning = 1,

    /// <summary>Plan is non-empty and changes are being applied.</summary>
    Applying = 2,

    /// <summary>Converged: observedGeneration == generation.</summary>
    Ready = 3,

    /// <summary>A change failed. Retryable while attempts remain.</summary>
    Degraded = 4,

    /// <summary>Attempts exhausted. Terminal until a human intervenes.</summary>
    Failed = 5,

    /// <summary>Teardown in progress, finalizers running in reverse order.</summary>
    Deleting = 6,

    /// <summary>Teardown complete. Terminal.</summary>
    Deleted = 7,
}

/// <summary>
/// The transition table from section 7.3, expressed once so that the domain,
/// the tests and any future UI all agree on what is legal.
/// </summary>
public static class TenantPhaseTransitions
{
    private static readonly Dictionary<TenantPhase, TenantPhase[]> Allowed = new()
    {
        [TenantPhase.Pending] = [TenantPhase.Planning],
        [TenantPhase.Planning] = [TenantPhase.Applying, TenantPhase.Ready],
        [TenantPhase.Applying] = [TenantPhase.Ready, TenantPhase.Degraded],
        [TenantPhase.Ready] = [TenantPhase.Planning, TenantPhase.Deleting],
        [TenantPhase.Degraded] = [TenantPhase.Planning, TenantPhase.Failed, TenantPhase.Deleting],
        [TenantPhase.Failed] = [TenantPhase.Planning],
        [TenantPhase.Deleting] = [TenantPhase.Deleted, TenantPhase.Degraded],
        [TenantPhase.Deleted] = [],
    };

    public static bool IsLegal(TenantPhase from, TenantPhase to) =>
        Allowed.TryGetValue(from, out var targets) && targets.Contains(to);

    public static IReadOnlyCollection<TenantPhase> LegalFrom(TenantPhase from) =>
        Allowed.TryGetValue(from, out var targets) ? targets : [];

    /// <summary>Phases from which no transition is possible without human action.</summary>
    public static bool IsTerminal(TenantPhase phase) => LegalFrom(phase).Count == 0;
}
