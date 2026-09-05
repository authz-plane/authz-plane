using AuthzPlane.Application.Tenants;
using AuthzPlane.Domain.Tenants;
using Microsoft.EntityFrameworkCore;

namespace AuthzPlane.Infrastructure.Persistence;

internal sealed class TenantRepository(AuthzPlaneDbContext db) : ITenantRepository
{
    public Task<Tenant?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        db.Tenants.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

    public Task<Tenant?> FindBySlugAsync(TenantSlug slug, CancellationToken cancellationToken = default) =>
        db.Tenants.FirstOrDefaultAsync(t => t.Slug == slug, cancellationToken);

    /// <summary>
    /// Ignores the soft-delete filter on purpose: a deleted tenant still owns
    /// its slug in external systems, so reusing it would collide.
    /// </summary>
    public Task<bool> SlugExistsAsync(TenantSlug slug, CancellationToken cancellationToken = default) =>
        db.Tenants.IgnoreQueryFilters().AnyAsync(t => t.Slug == slug, cancellationToken);

    public Task<TenantStatus?> FindStatusAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
        db.TenantStatuses.FirstOrDefaultAsync(s => s.TenantId == tenantId, cancellationToken);

    public Task<TenantSpec?> FindLatestSpecAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
        db.TenantSpecs
            .Where(s => s.TenantId == tenantId)
            .OrderByDescending(s => s.Generation)
            .FirstOrDefaultAsync(cancellationToken);

    public void Add(Tenant tenant) => db.Tenants.Add(tenant);

    public void AddStatus(TenantStatus status) => db.TenantStatuses.Add(status);

    public void AddSpec(TenantSpec spec) => db.TenantSpecs.Add(spec);
}
