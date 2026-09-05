using AuthzPlane.Application.Tenants;
using AuthzPlane.Domain.Tenants;
using Microsoft.EntityFrameworkCore;

namespace AuthzPlane.Infrastructure.Persistence;

/// <summary>
/// Write-side access to the tenant aggregate. Every load here is tracked: the
/// context defaults to NoTracking for reads, and a handler that calls
/// <c>tenant.BumpGeneration()</c> on an untracked instance would save nothing
/// and report success. <c>AsTracking()</c> on each query is the opt-in.
/// </summary>
internal sealed class TenantRepository(AuthzPlaneDbContext db) : ITenantRepository
{
    public Task<Tenant?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        db.Tenants.AsTracking().FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

    public Task<Tenant?> FindBySlugAsync(TenantSlug slug, CancellationToken cancellationToken = default) =>
        db.Tenants.AsTracking().FirstOrDefaultAsync(t => t.Slug == slug, cancellationToken);

    /// <summary>
    /// Ignores the soft-delete filter on purpose: a deleted tenant still owns
    /// its slug in external systems, so reusing it would collide.
    /// </summary>
    public Task<bool> SlugExistsAsync(TenantSlug slug, CancellationToken cancellationToken = default) =>
        db.Tenants.IgnoreQueryFilters().AnyAsync(t => t.Slug == slug, cancellationToken);

    public Task<TenantStatus?> FindStatusAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
        db.TenantStatuses.AsTracking().FirstOrDefaultAsync(s => s.TenantId == tenantId, cancellationToken);

    public Task<TenantSpec?> FindLatestSpecAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
        db.TenantSpecs
            .AsTracking()
            .Where(s => s.TenantId == tenantId)
            .OrderByDescending(s => s.Generation)
            .FirstOrDefaultAsync(cancellationToken);

    public void Add(Tenant tenant) => db.Tenants.Add(tenant);

    public void AddStatus(TenantStatus status) => db.TenantStatuses.Add(status);

    public void AddSpec(TenantSpec spec) => db.TenantSpecs.Add(spec);
}
