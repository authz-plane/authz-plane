namespace AuthzPlane.Domain.Reconciliation;

/// <summary>Why a reconcile run started. Useful when reading run history.</summary>
public enum ReconcileTrigger
{
    SpecChanged = 0,
    DriftDetected = 1,
    Manual = 2,
    PeriodicResync = 3,
    Deletion = 4,
}

/// <summary>How a run ended.</summary>
public enum RunOutcome
{
    /// <summary>Still running.</summary>
    InProgress = 0,

    /// <summary>Plan was empty; already converged. The no-op case.</summary>
    NoOp = 1,

    Succeeded = 2,

    /// <summary>Some changes applied, at least one failed. Visible per-change in the UI.</summary>
    PartiallyApplied = 3,

    Failed = 4,

    /// <summary>Another run held the advisory lock.</summary>
    Skipped = 5,
}

/// <summary>The external systems a change can target.</summary>
public enum ResourceKind
{
    Organization = 0,
    IdentityProvider = 1,
    User = 2,
    AuthorizationModel = 3,
    RelationTuple = 4,
}

public enum ChangeOperation
{
    Create = 0,
    Update = 1,
    Delete = 2,
}

public enum ChangeStatus
{
    Pending = 0,
    Applied = 1,
    Failed = 2,

    /// <summary>changeKey already in the external resource map: a no-op read.</summary>
    AlreadyApplied = 3,
}

public enum DriftSeverity
{
    Low = 0,
    Medium = 1,
    High = 2,
}
