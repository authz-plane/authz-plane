using AuthzPlane.Domain.Tenants;

namespace AuthzPlane.Application.Tenants;

/// <summary>Persistence port for the tenant aggregate.</summary>
public interface ITenantRepository
{
    Task<Tenant?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<Tenant?> FindBySlugAsync(TenantSlug slug, CancellationToken cancellationToken = default);

    Task<bool> SlugExistsAsync(TenantSlug slug, CancellationToken cancellationToken = default);

    Task<TenantStatus?> FindStatusAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>Latest spec version, or null when none has been written.</summary>
    Task<TenantSpec?> FindLatestSpecAsync(Guid tenantId, CancellationToken cancellationToken = default);

    void Add(Tenant tenant);

    void AddStatus(TenantStatus status);

    void AddSpec(TenantSpec spec);
}
