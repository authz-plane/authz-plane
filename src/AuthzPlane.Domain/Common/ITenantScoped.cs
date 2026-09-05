namespace AuthzPlane.Domain.Common;

/// <summary>
/// Marks an entity as belonging to exactly one tenant.
/// </summary>
/// <remarks>
/// Every implementor MUST have a global query filter registered in the
/// DbContext. This is not left to discipline: an architecture test walks the
/// built EF model and fails the build if any <see cref="ITenantScoped"/> entity
/// lacks a filter. Adding an entity and forgetting the filter is a compile-time
/// class of failure, not a data leak discovered in production.
/// </remarks>
public interface ITenantScoped
{
    Guid TenantId { get; }
}
