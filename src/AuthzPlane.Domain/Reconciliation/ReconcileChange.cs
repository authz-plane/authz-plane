using AuthzPlane.Domain.Common;

namespace AuthzPlane.Domain.Reconciliation;

/// <summary>
/// One intended mutation of an external system, and how it went.
/// </summary>
/// <remarks>
/// Per-change status rows are what make a <c>PartiallyApplied</c> run
/// intelligible: the UI can show exactly which change failed and why, instead of
/// a single opaque run-level error.
/// </remarks>
public sealed class ReconcileChange : Entity
{
    private ReconcileChange()
    {
    }

    private ReconcileChange(
        Guid id,
        Guid runId,
        ChangeKey changeKey,
        ResourceKind resourceKind,
        string resourceRef,
        ChangeOperation operation,
        int ordinal)
        : base(id)
    {
        RunId = runId;
        ChangeKey = changeKey;
        ResourceKind = resourceKind;
        ResourceRef = resourceRef;
        Operation = operation;
        Ordinal = ordinal;
        Status = ChangeStatus.Pending;
    }

    public Guid RunId { get; private set; }

    public ChangeKey ChangeKey { get; private set; }

    public ResourceKind ResourceKind { get; private set; }

    public string ResourceRef { get; private set; } = string.Empty;

    public ChangeOperation Operation { get; private set; }

    /// <summary>Position in the plan. Teardown runs in reverse dependency order.</summary>
    public int Ordinal { get; private set; }

    public ChangeStatus Status { get; private set; }

    public string? Error { get; private set; }

    public int? DurationMs { get; private set; }

    public static ReconcileChange Create(
        Guid id,
        Guid runId,
        ChangeKey changeKey,
        ResourceKind resourceKind,
        string resourceRef,
        ChangeOperation operation,
        int ordinal)
    {
        if (runId == Guid.Empty)
        {
            throw new DomainException("Reconcile change requires a run id.");
        }

        if (string.IsNullOrWhiteSpace(resourceRef))
        {
            throw new DomainException("Reconcile change requires a resource ref.");
        }

        if (ordinal < 0)
        {
            throw new DomainException($"Ordinal cannot be negative; got {ordinal}.");
        }

        return new ReconcileChange(
            id, runId, changeKey, resourceKind, resourceRef, operation, ordinal);
    }

    public void MarkApplied(int durationMs) => Settle(ChangeStatus.Applied, null, durationMs);

    /// <summary>The change key was already in the external resource map.</summary>
    public void MarkAlreadyApplied(int durationMs) =>
        Settle(ChangeStatus.AlreadyApplied, null, durationMs);

    public void MarkFailed(string error, int durationMs)
    {
        if (string.IsNullOrWhiteSpace(error))
        {
            throw new DomainException("A failed change requires an error message.");
        }

        Settle(ChangeStatus.Failed, error, durationMs);
    }

    private void Settle(ChangeStatus status, string? error, int durationMs)
    {
        if (Status != ChangeStatus.Pending)
        {
            throw new DomainException(
                $"Change {ChangeKey} is already {Status} and cannot be settled again.");
        }

        if (durationMs < 0)
        {
            throw new DomainException($"Duration cannot be negative; got {durationMs}.");
        }

        Status = status;
        Error = error;
        DurationMs = durationMs;
    }
}
