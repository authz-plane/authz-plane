using AuthzPlane.Domain.Common;
using AuthzPlane.Domain.Tenants;

namespace AuthzPlane.Domain.Reconciliation;

/// <summary>
/// One execution of the reconcile loop for one tenant at one generation.
/// </summary>
public sealed class ReconcileRun : Entity, ITenantScoped
{
    private readonly List<ReconcileChange> _changes = [];

    private ReconcileRun()
    {
    }

    private ReconcileRun(
        Guid id, Guid tenantId, Generation generation, ReconcileTrigger trigger, DateTimeOffset startedAt)
        : base(id)
    {
        TenantId = tenantId;
        Generation = generation;
        Trigger = trigger;
        StartedAt = startedAt;
        Outcome = RunOutcome.InProgress;
    }

    public Guid TenantId { get; private set; }

    /// <summary>The desired generation this run is trying to converge to.</summary>
    public Generation Generation { get; private set; }

    public ReconcileTrigger Trigger { get; private set; }

    public RunOutcome Outcome { get; private set; }

    /// <summary>Object-store key of the pre-apply snapshot, if one was taken.</summary>
    public string? SnapshotKey { get; private set; }

    public DateTimeOffset StartedAt { get; private set; }

    public DateTimeOffset? FinishedAt { get; private set; }

    public IReadOnlyList<ReconcileChange> Changes => _changes;

    public bool IsFinished => Outcome != RunOutcome.InProgress;

    public static ReconcileRun Start(
        Guid id, Guid tenantId, Generation generation, ReconcileTrigger trigger, DateTimeOffset startedAt)
    {
        if (tenantId == Guid.Empty)
        {
            throw new DomainException("Reconcile run requires a tenant id.");
        }

        return new ReconcileRun(id, tenantId, generation, trigger, startedAt);
    }

    public void AddChange(ReconcileChange change)
    {
        EnsureRunning();

        if (change.RunId != Id)
        {
            throw new DomainException("Change belongs to a different run.");
        }

        if (_changes.Any(c => c.ChangeKey == change.ChangeKey))
        {
            throw new DomainException(
                $"Change key {change.ChangeKey} already present in this run.");
        }

        _changes.Add(change);
    }

    public void RecordSnapshot(string snapshotKey)
    {
        EnsureRunning();
        SnapshotKey = snapshotKey;
    }

    /// <summary>
    /// Ends the run, deriving the outcome from the per-change results rather
    /// than trusting a caller-supplied value.
    /// </summary>
    public RunOutcome Finish(DateTimeOffset finishedAt)
    {
        EnsureRunning();

        if (_changes.Count == 0)
        {
            Outcome = RunOutcome.NoOp;
        }
        else
        {
            var failed = _changes.Count(c => c.Status == ChangeStatus.Failed);
            var settled = _changes.Count(c => c.Status != ChangeStatus.Pending);

            Outcome = failed switch
            {
                0 when settled == _changes.Count => RunOutcome.Succeeded,
                _ when failed == _changes.Count => RunOutcome.Failed,
                _ => RunOutcome.PartiallyApplied,
            };
        }

        FinishedAt = finishedAt;
        return Outcome;
    }

    /// <summary>Another worker held the advisory lock, so this run did nothing.</summary>
    public void Skip(DateTimeOffset finishedAt)
    {
        EnsureRunning();

        if (_changes.Count != 0)
        {
            throw new DomainException("A run that applied changes cannot be marked Skipped.");
        }

        Outcome = RunOutcome.Skipped;
        FinishedAt = finishedAt;
    }

    private void EnsureRunning()
    {
        if (IsFinished)
        {
            throw new DomainException($"Run {Id} already finished as {Outcome}.");
        }
    }
}
