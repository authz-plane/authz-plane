using System.Text.Json;
using AuthzPlane.Application.Common;
using AuthzPlane.Application.Tenants.Queries;
using AuthzPlane.Domain.Tenants;
using Microsoft.EntityFrameworkCore;

namespace AuthzPlane.Infrastructure.Persistence.Queries;

/// <summary>
/// Read side for tenants: projections, no tracking, keyset paging.
/// </summary>
/// <remarks>
/// These queries opt out of the tenant query filter with
/// <c>IgnoreQueryFilters()</c> and re-apply the tenant predicate explicitly.
/// They are platform-operator reads addressed by tenant id in the URL, so the
/// ambient scope is not the source of truth for which tenant is meant. The
/// soft-delete filter on <c>tenants</c> is kept: deleted tenants are 404.
/// </remarks>
internal sealed class TenantQueries(AuthzPlaneDbContext db) : ITenantQueries
{
    public async Task<TenantPage> ListAsync(TenantListQuery query, CancellationToken cancellationToken = default)
    {
        var limit = query.EffectiveLimit;

        var rows = db.Tenants
            .Join(
                db.TenantStatuses.IgnoreQueryFilters(),
                t => t.Id,
                s => s.TenantId,
                (t, s) => new { Tenant = t, Status = s });

        if (query.Phase is { } phase)
        {
            rows = rows.Where(x => x.Status.Phase == phase);
        }

        if (Cursor.TryDecode(query.Cursor, out var after))
        {
            // Keyset: strictly older than the cursor row in (created_at desc, id desc) order.
            rows = rows.Where(x =>
                x.Tenant.CreatedAt < after.CreatedAt ||
                (x.Tenant.CreatedAt == after.CreatedAt && x.Tenant.Id.CompareTo(after.Id) < 0));
        }

        var page = await rows
            .OrderByDescending(x => x.Tenant.CreatedAt)
            .ThenByDescending(x => x.Tenant.Id)
            .Take(limit + 1)
            .Select(x => new
            {
                x.Tenant.Id,
                x.Tenant.Slug,
                x.Tenant.DisplayName,
                x.Tenant.Generation,
                x.Tenant.CreatedAt,
                x.Status.Phase,
                x.Status.ObservedGeneration,
                x.Status.LastReconciledAt,
            })
            .ToListAsync(cancellationToken);

        var hasMore = page.Count > limit;
        var items = page.Take(limit)
            .Select(x => new TenantSummary(
                x.Id, x.Slug.Value, x.DisplayName, x.Generation.Value, x.Phase,
                x.ObservedGeneration.Value, x.LastReconciledAt, x.CreatedAt))
            .ToList();

        var last = items.Count > 0 ? items[^1] : null;
        var nextCursor = hasMore && last is not null ? Cursor.Encode(last.CreatedAt, last.Id) : null;

        return new TenantPage(items, nextCursor);
    }

    public async Task<TenantDetail?> GetAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        if (tenant is null)
        {
            return null;
        }

        var status = await GetStatusAsync(tenantId, cancellationToken)
            ?? throw new InvalidOperationException($"Tenant {tenantId} has no status row.");

        var spec = await SpecsFor(tenantId)
            .OrderByDescending(s => s.Generation)
            .FirstOrDefaultAsync(cancellationToken);

        return new TenantDetail(
            tenant.Id,
            tenant.Slug.Value,
            tenant.DisplayName,
            tenant.Generation.Value,
            tenant.CreatedAt,
            status,
            spec is null ? null : ToVersion(spec));
    }

    public async Task<TenantStatusView?> GetStatusAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var status = await db.TenantStatuses
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId, cancellationToken);

        return status is null
            ? null
            : new TenantStatusView(
                status.Phase,
                status.ObservedGeneration.Value,
                status.LastError,
                status.ConsecutiveFailures,
                status.LastReconciledAt,
                status.NextAttemptAt,
                status.LastTransitionAt);
    }

    public async Task<IReadOnlyList<SpecVersion>> ListSpecVersionsAsync(
        Guid tenantId, CancellationToken cancellationToken = default)
    {
        var specs = await SpecsFor(tenantId)
            .OrderByDescending(s => s.Generation)
            .ToListAsync(cancellationToken);

        return specs.Select(ToVersion).ToList();
    }

    public async Task<SpecVersion?> GetSpecVersionAsync(
        Guid tenantId, long generation, CancellationToken cancellationToken = default)
    {
        var wanted = Generation.From(generation);
        var spec = await SpecsFor(tenantId)
            .FirstOrDefaultAsync(s => s.Generation == wanted, cancellationToken);

        return spec is null ? null : ToVersion(spec);
    }

    private IQueryable<TenantSpec> SpecsFor(Guid tenantId) =>
        db.TenantSpecs.IgnoreQueryFilters().Where(s => s.TenantId == tenantId);

    private static SpecVersion ToVersion(TenantSpec spec)
    {
        using var doc = JsonDocument.Parse(spec.SpecJson);
        return new SpecVersion(
            spec.Generation.Value,
            spec.SpecHash.Value,
            spec.CreatedBy,
            spec.CreatedAt,
            doc.RootElement.Clone());
    }
}
