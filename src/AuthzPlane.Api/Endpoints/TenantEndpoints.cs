using AuthzPlane.Api.Contracts;
using AuthzPlane.Api.Http;
using AuthzPlane.Application.Tenants.Commands;
using AuthzPlane.Application.Tenants.Queries;
using AuthzPlane.Domain.Tenants;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Net.Http.Headers;

namespace AuthzPlane.Api.Endpoints;

/// <summary>
/// <c>/v1/tenants</c>. Minimal APIs, one static method per route: the endpoint
/// parses HTTP, calls one handler or query, and maps the result. No business
/// logic lives here, which is what keeps the handlers testable without a host.
/// </summary>
public static class TenantEndpoints
{
    public static RouteGroupBuilder MapTenantEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/v1/tenants").WithTags("Tenants");

        group.MapPost("/", CreateAsync)
            .WithName("CreateTenant")
            .WithSummary("Create a tenant with its first spec (generation 1) and enqueue the first reconcile.");

        group.MapGet("/", ListAsync)
            .WithName("ListTenants")
            .WithSummary("Cursor-paginated tenant list, newest first, optionally filtered by phase.");

        group.MapGet("/{id:guid}", GetAsync)
            .WithName("GetTenant")
            .WithSummary("Spec and status projection for one tenant. ETag carries the generation.");

        group.MapGet("/{id:guid}/status", GetStatusAsync)
            .WithName("GetTenantStatus");

        group.MapGet("/{id:guid}/spec/versions", ListSpecVersionsAsync)
            .WithName("ListSpecVersions");

        group.MapGet("/{id:guid}/spec/versions/{generation:long}", GetSpecVersionAsync)
            .WithName("GetSpecVersion");

        group.MapPut("/{id:guid}/spec", UpdateSpecAsync)
            .WithName("UpdateTenantSpec")
            .WithSummary("Append a new immutable spec version. Requires If-Match: <current generation>.");

        return group;
    }

    private static async Task<IResult> CreateAsync(
        CreateTenantRequest body, CreateTenantHandler handler, CancellationToken cancellationToken)
    {
        var result = await handler.HandleAsync(
            new CreateTenantCommand(body.Slug, body.DisplayName, body.Spec), cancellationToken);

        return result.Match(
            created => Results.Created($"/v1/tenants/{created.TenantId}", TenantCreatedResponse.From(created)),
            ProblemResults.From);
    }

    private static async Task<Ok<TenantPageResponse>> ListAsync(
        TenantPhase? phase, string? cursor, int? limit, ITenantQueries queries, CancellationToken cancellationToken)
    {
        var page = await queries.ListAsync(
            new TenantListQuery(phase, cursor, limit ?? TenantListQuery.DefaultLimit), cancellationToken);

        return TypedResults.Ok(TenantPageResponse.From(page));
    }

    private static async Task<IResult> GetAsync(
        Guid id, HttpResponse response, ITenantQueries queries, CancellationToken cancellationToken)
    {
        var tenant = await queries.GetAsync(id, cancellationToken);
        if (tenant is null)
        {
            return NotFound(id);
        }

        response.Headers.ETag = ETag(tenant.Generation);
        return Results.Ok(TenantResponse.From(tenant));
    }

    private static async Task<IResult> GetStatusAsync(
        Guid id, ITenantQueries queries, CancellationToken cancellationToken)
    {
        var status = await queries.GetStatusAsync(id, cancellationToken);
        return status is null ? NotFound(id) : Results.Ok(TenantStatusResponse.From(status));
    }

    private static async Task<IResult> ListSpecVersionsAsync(
        Guid id, ITenantQueries queries, CancellationToken cancellationToken)
    {
        if (await queries.GetStatusAsync(id, cancellationToken) is null)
        {
            return NotFound(id);
        }

        var versions = await queries.ListSpecVersionsAsync(id, cancellationToken);
        return Results.Ok(versions.Select(SpecVersionResponse.From).ToList());
    }

    private static async Task<IResult> GetSpecVersionAsync(
        Guid id, long generation, ITenantQueries queries, CancellationToken cancellationToken)
    {
        if (generation < 1)
        {
            return ProblemResults.Problem(StatusCodes.Status400BadRequest, "Invalid generation", "Generations start at 1.");
        }

        var version = await queries.GetSpecVersionAsync(id, generation, cancellationToken);
        return version is null
            ? ProblemResults.Problem(
                StatusCodes.Status404NotFound, "Spec version not found", $"Tenant {id} has no spec at generation {generation}.")
            : Results.Ok(SpecVersionResponse.From(version));
    }

    private static async Task<IResult> UpdateSpecAsync(
        Guid id,
        UpdateSpecRequest body,
        HttpRequest request,
        HttpResponse response,
        UpdateTenantSpecHandler handler,
        CancellationToken cancellationToken)
    {
        if (!TryReadIfMatch(request, out var expectedGeneration))
        {
            return ProblemResults.Problem(
                StatusCodes.Status400BadRequest,
                "Malformed If-Match",
                "If-Match must be the tenant generation you edited from, e.g. If-Match: \"9\".");
        }

        var result = await handler.HandleAsync(
            new UpdateTenantSpecCommand(id, expectedGeneration, body.Spec), cancellationToken);

        return result.Match(
            written =>
            {
                response.Headers.ETag = ETag(written.Generation);
                return Results.Ok(SpecWrittenResponse.From(written));
            },
            ProblemResults.From);
    }

    /// <summary>
    /// Accepts <c>"9"</c>, <c>W/"9"</c> or bare <c>9</c>. Absent is reported as
    /// null and becomes a 428 in the handler; present-but-garbage is a 400 here.
    /// </summary>
    private static bool TryReadIfMatch(HttpRequest request, out long? generation)
    {
        generation = null;
        var raw = request.Headers[HeaderNames.IfMatch].ToString().Trim();
        if (raw.Length == 0)
        {
            return true;
        }

        if (raw.StartsWith("W/", StringComparison.Ordinal))
        {
            raw = raw[2..];
        }

        raw = raw.Trim('"');
        if (!long.TryParse(raw, out var value) || value < 0)
        {
            return false;
        }

        generation = value;
        return true;
    }

    private static string ETag(long generation) => $"\"{generation}\"";

    private static IResult NotFound(Guid id) =>
        ProblemResults.Problem(StatusCodes.Status404NotFound, "Tenant not found", $"No tenant with id {id}.");
}
