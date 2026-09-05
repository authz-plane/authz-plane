using System.Text.Json;
using AuthzPlane.Domain.Tenants;

namespace AuthzPlane.Application.Tenants.Queries;

/// <summary>Filter for <c>GET /v1/tenants</c>. The cursor is opaque; see <see cref="Common.Cursor"/>.</summary>
public sealed record TenantListQuery(TenantPhase? Phase = null, string? Cursor = null, int Limit = TenantListQuery.DefaultLimit)
{
    public const int DefaultLimit = 25;
    public const int MaxLimit = 100;

    /// <summary>Limit clamped to [1, <see cref="MaxLimit"/>]. Never trust the query string.</summary>
    public int EffectiveLimit => Math.Clamp(Limit, 1, MaxLimit);
}

public sealed record TenantSummary(
    Guid Id,
    string Slug,
    string DisplayName,
    long Generation,
    TenantPhase Phase,
    long ObservedGeneration,
    DateTimeOffset? LastReconciledAt,
    DateTimeOffset CreatedAt);

public sealed record TenantPage(IReadOnlyList<TenantSummary> Items, string? NextCursor);

public sealed record TenantStatusView(
    TenantPhase Phase,
    long ObservedGeneration,
    string? LastError,
    int ConsecutiveFailures,
    DateTimeOffset? LastReconciledAt,
    DateTimeOffset? NextAttemptAt,
    DateTimeOffset LastTransitionAt);

public sealed record SpecVersion(
    long Generation,
    string SpecHash,
    string CreatedBy,
    DateTimeOffset CreatedAt,
    JsonElement Spec);

/// <summary>Spec plus status projection returned by <c>GET /v1/tenants/{id}</c>.</summary>
public sealed record TenantDetail(
    Guid Id,
    string Slug,
    string DisplayName,
    long Generation,
    DateTimeOffset CreatedAt,
    TenantStatusView Status,
    SpecVersion? CurrentSpec);

/// <summary>
/// Read side for tenants. Separate from <see cref="ITenantRepository"/> because
/// reads project across tenants (the list is a platform-operator view) and want
/// no change tracking, while the repository loads aggregates for mutation.
/// </summary>
public interface ITenantQueries
{
    /// <summary>Platform-wide, newest first. Implementations opt out of the tenant filter explicitly.</summary>
    Task<TenantPage> ListAsync(TenantListQuery query, CancellationToken cancellationToken = default);

    Task<TenantDetail?> GetAsync(Guid tenantId, CancellationToken cancellationToken = default);

    Task<TenantStatusView?> GetStatusAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>All versions, newest first. Spec bodies included; history is small.</summary>
    Task<IReadOnlyList<SpecVersion>> ListSpecVersionsAsync(Guid tenantId, CancellationToken cancellationToken = default);

    Task<SpecVersion?> GetSpecVersionAsync(Guid tenantId, long generation, CancellationToken cancellationToken = default);
}
