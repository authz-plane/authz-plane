using System.Text.Json;
using AuthzPlane.Application.Tenants.Commands;
using AuthzPlane.Application.Tenants.Queries;
using AuthzPlane.Domain.Tenants;

namespace AuthzPlane.Api.Contracts;

// Wire shapes for /v1/tenants. Kept apart from Application's command, query and
// result types (ADR-011) so the HTTP contract can evolve without touching use
// cases, and so OpenAPI documents exactly what crosses the wire.

/// <summary>Body of <c>POST /v1/tenants</c>.</summary>
public sealed record CreateTenantRequest(string Slug, string DisplayName, JsonElement Spec);

public sealed record TenantCreatedResponse(Guid Id, string Slug, long Generation, string SpecHash)
{
    public static TenantCreatedResponse From(TenantCreated created) =>
        new(created.TenantId, created.Slug, created.Generation, created.SpecHash);
}

/// <summary>Body of <c>PUT /v1/tenants/{id}/spec</c>. The generation comes from <c>If-Match</c>, not the body.</summary>
public sealed record UpdateSpecRequest(JsonElement Spec);

public sealed record SpecWrittenResponse(Guid TenantId, long Generation, string SpecHash, bool Changed)
{
    public static SpecWrittenResponse From(SpecWritten written) =>
        new(written.TenantId, written.Generation, written.SpecHash, written.Changed);
}

public sealed record TenantStatusResponse(
    TenantPhase Phase,
    long ObservedGeneration,
    string? LastError,
    int ConsecutiveFailures,
    DateTimeOffset? LastReconciledAt,
    DateTimeOffset? NextAttemptAt,
    DateTimeOffset LastTransitionAt)
{
    public static TenantStatusResponse From(TenantStatusView s) =>
        new(s.Phase, s.ObservedGeneration, s.LastError, s.ConsecutiveFailures, s.LastReconciledAt, s.NextAttemptAt, s.LastTransitionAt);
}

public sealed record SpecVersionResponse(long Generation, string SpecHash, string CreatedBy, DateTimeOffset CreatedAt, JsonElement Spec)
{
    public static SpecVersionResponse From(SpecVersion v) =>
        new(v.Generation, v.SpecHash, v.CreatedBy, v.CreatedAt, v.Spec);
}

public sealed record TenantSummaryResponse(
    Guid Id,
    string Slug,
    string DisplayName,
    long Generation,
    TenantPhase Phase,
    long ObservedGeneration,
    DateTimeOffset? LastReconciledAt,
    DateTimeOffset CreatedAt)
{
    public static TenantSummaryResponse From(TenantSummary t) =>
        new(t.Id, t.Slug, t.DisplayName, t.Generation, t.Phase, t.ObservedGeneration, t.LastReconciledAt, t.CreatedAt);
}

/// <summary>Cursor-paginated list. <c>NextCursor</c> is null on the last page.</summary>
public sealed record TenantPageResponse(IReadOnlyList<TenantSummaryResponse> Items, string? NextCursor)
{
    public static TenantPageResponse From(TenantPage page) =>
        new(page.Items.Select(TenantSummaryResponse.From).ToList(), page.NextCursor);
}

/// <summary>Spec plus status projection: what the console's tenant detail screen renders.</summary>
public sealed record TenantResponse(
    Guid Id,
    string Slug,
    string DisplayName,
    long Generation,
    DateTimeOffset CreatedAt,
    TenantStatusResponse Status,
    SpecVersionResponse? CurrentSpec)
{
    public static TenantResponse From(TenantDetail d) =>
        new(
            d.Id, d.Slug, d.DisplayName, d.Generation, d.CreatedAt,
            TenantStatusResponse.From(d.Status),
            d.CurrentSpec is null ? null : SpecVersionResponse.From(d.CurrentSpec));
}
