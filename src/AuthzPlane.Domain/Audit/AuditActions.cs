namespace AuthzPlane.Domain.Audit;

/// <summary>
/// Audit action names. Past tense, one per mutation the API or reconciler can
/// perform. The console colours these by name, so they are part of the contract.
/// </summary>
public static class AuditActions
{
    public const string TenantCreated = "TenantCreated";
    public const string TenantRenamed = "TenantRenamed";
    public const string TenantDeleteRequested = "TenantDeleteRequested";
    public const string SpecUpdated = "SpecUpdated";
    public const string ReconcileRequested = "ReconcileRequested";
    public const string ReconcileSucceeded = "ReconcileSucceeded";
    public const string ReconcileDegraded = "ReconcileDegraded";
    public const string ReconcileFailed = "ReconcileFailed";
    public const string DriftDetected = "DriftDetected";
    public const string DriftHealed = "DriftHealed";
    public const string DriftAcknowledged = "DriftAcknowledged";
    public const string RelationsWritten = "RelationsWritten";
    public const string IdpSecretRotated = "IdpSecretRotated";
    public const string CheckExplained = "CheckExplained";
}
