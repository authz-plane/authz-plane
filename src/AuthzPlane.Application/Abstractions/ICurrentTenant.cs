namespace AuthzPlane.Application.Abstractions;

/// <summary>
/// The tenant scope of the current request or worker iteration.
/// </summary>
/// <remarks>
/// Resolved per request and consumed by the DbContext's global query filters.
/// See the remarks on the DbContext for why the filters must reference a
/// context property rather than this service directly - getting that wrong is a
/// silent cross-tenant data leak.
/// </remarks>
public interface ICurrentTenant
{
    /// <summary>Null when unscoped, e.g. during a platform-admin operation.</summary>
    Guid? TenantId { get; }
}

/// <summary>Allows a worker to set tenant scope for one unit of work.</summary>
public interface ITenantScopeSetter
{
    IDisposable Enter(Guid tenantId);
}
