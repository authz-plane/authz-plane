namespace AuthzPlane.Domain.Outbox;

/// <summary>
/// The closed set of outbox message types. Strings rather than an enum so the
/// column stays readable in SQL and adding a type is not a migration.
/// </summary>
public static class OutboxMessageTypes
{
    /// <summary>A new spec generation was written; the reconciler should converge to it.</summary>
    public const string TenantSpecWritten = "tenant.spec.written";

    /// <summary>The tenant entered Deleting; the reconciler should run finalizers.</summary>
    public const string TenantDeleteRequested = "tenant.delete.requested";

    /// <summary>An operator asked for a reconcile without changing the spec.</summary>
    public const string TenantReconcileRequested = "tenant.reconcile.requested";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        TenantSpecWritten,
        TenantDeleteRequested,
        TenantReconcileRequested,
    };
}
