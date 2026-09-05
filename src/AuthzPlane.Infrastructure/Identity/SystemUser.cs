using AuthzPlane.Application.Abstractions;

namespace AuthzPlane.Infrastructure.Identity;

/// <summary>
/// The actor when no human is present: the reconciler role. The API registers an
/// HTTP-backed <see cref="ICurrentUser"/> ahead of this one, so this only applies
/// when the process runs as the worker.
/// </summary>
public sealed class SystemUser : ICurrentUser
{
    public const string ReconcilerId = "system:reconciler";

    public string Id => ReconcilerId;

    public bool IsSystem => true;
}

/// <summary>No correlation available. Replaced by the API with per-request values.</summary>
public sealed class NullRequestContext : IRequestContext
{
    public string? RequestId => null;

    public string? TraceId => null;
}
