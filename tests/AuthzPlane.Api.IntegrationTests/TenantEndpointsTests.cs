using System.Net;
using System.Net.Http.Json;
using AuthzPlane.Domain.Audit;
using AuthzPlane.Domain.Outbox;
using AuthzPlane.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AuthzPlane.Api.IntegrationTests;

public sealed class TenantEndpointsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    private sealed record Rows(int Specs, long Generation, int Outbox, int Audit);

    private async Task<Rows> RowsFor(Guid tenantId)
    {
        await using var scope = factory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AuthzPlaneDbContext>();
        return new Rows(
            await db.TenantSpecs.IgnoreQueryFilters().CountAsync(s => s.TenantId == tenantId),
            (await db.Tenants.IgnoreQueryFilters().SingleAsync(t => t.Id == tenantId)).Generation.Value,
            await db.OutboxMessages.IgnoreQueryFilters().CountAsync(m => m.TenantId == tenantId),
            await db.AuditEvents.IgnoreQueryFilters().CountAsync(a => a.TenantId == tenantId));
    }

    [Fact]
    public async Task Create_returns_201_with_location_and_the_tenant_is_readable()
    {
        var slug = Api.UniqueSlug();
        var response = await _client.Post("/v1/tenants", Api.CreateBody(slug, "Acme Air"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Json();
        var id = body.GetProperty("id").GetGuid();
        Assert.Equal($"/v1/tenants/{id}", response.Headers.Location!.ToString());
        Assert.Equal(1, body.GetProperty("generation").GetInt64());
        Assert.Equal(64, body.GetProperty("specHash").GetString()!.Length);

        var get = await _client.GetAsync($"/v1/tenants/{id}");
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);
        Assert.Equal("\"1\"", get.Headers.ETag!.Tag);
        var detail = await get.Json();
        Assert.Equal(slug, detail.GetProperty("slug").GetString());
        Assert.Equal("Acme Air", detail.GetProperty("displayName").GetString());
        Assert.Equal("Pending", detail.GetProperty("status").GetProperty("phase").GetString());
        Assert.Equal(0, detail.GetProperty("status").GetProperty("observedGeneration").GetInt64());
        Assert.Equal(1, detail.GetProperty("currentSpec").GetProperty("generation").GetInt64());
        Assert.Equal("tenant_admin", detail.GetProperty("currentSpec").GetProperty("spec").GetProperty("roles")[0].GetProperty("key").GetString());
    }

    [Fact]
    public async Task Create_commits_tenant_status_spec_outbox_and_audit_together()
    {
        var (id, _) = await _client.CreateTenant();

        await using var scope = factory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AuthzPlaneDbContext>();

        Assert.NotNull(await db.TenantStatuses.IgnoreQueryFilters().SingleOrDefaultAsync(s => s.TenantId == id));
        var spec = await db.TenantSpecs.IgnoreQueryFilters().SingleAsync(s => s.TenantId == id);
        Assert.Equal(1, spec.Generation.Value);
        Assert.Equal("dev:operator", spec.CreatedBy);

        var message = await db.OutboxMessages.IgnoreQueryFilters().SingleAsync(m => m.TenantId == id);
        Assert.Equal(OutboxMessageTypes.TenantSpecWritten, message.Type);
        Assert.Null(message.ProcessedAt);

        var audit = await db.AuditEvents.IgnoreQueryFilters().Where(a => a.TenantId == id).OrderBy(a => a.Action).ToListAsync();
        Assert.Equal([AuditActions.SpecUpdated, AuditActions.TenantCreated], audit.Select(a => a.Action));
        Assert.All(audit, a => Assert.Equal("dev:operator", a.Actor));
        Assert.All(audit, a => Assert.False(string.IsNullOrEmpty(a.RequestId)));
        Assert.Contains(spec.SpecHash.Value, audit.Single(a => a.Action == AuditActions.SpecUpdated).After);
    }

    [Fact]
    public async Task Create_rejects_bad_input_as_problem_json()
    {
        var invalid = await _client.Post("/v1/tenants", Api.CreateBody("Not A Slug"));
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        Assert.Equal("application/problem+json", invalid.Content.Headers.ContentType!.MediaType);
        var problem = await invalid.Json();
        Assert.Equal("Invalid tenant slug", problem.GetProperty("title").GetString());

        var slug = Api.UniqueSlug();
        await _client.CreateTenant(slug);
        var duplicate = await _client.Post("/v1/tenants", Api.CreateBody(slug));
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
    }

    [Fact]
    public async Task Update_spec_needs_a_matching_If_Match_and_bumps_the_generation()
    {
        var (id, _) = await _client.CreateTenant();
        var newSpec = new { spec = new { roles = new[] { new { key = "tenant_admin" }, new { key = "tenant_viewer" } } } };

        var missing = await _client.Put($"/v1/tenants/{id}/spec", newSpec, ifMatch: null);
        Assert.Equal(HttpStatusCode.PreconditionRequired, missing.StatusCode);

        var stale = await _client.Put($"/v1/tenants/{id}/spec", newSpec, ifMatch: "\"7\"");
        Assert.Equal(HttpStatusCode.PreconditionFailed, stale.StatusCode);
        Assert.Equal(1, (await stale.Json()).GetProperty("currentGeneration").GetInt64());

        var malformed = await _client.Put($"/v1/tenants/{id}/spec", newSpec, ifMatch: "\"abc\"");
        Assert.Equal(HttpStatusCode.BadRequest, malformed.StatusCode);

        var ok = await _client.Put($"/v1/tenants/{id}/spec", newSpec, ifMatch: "\"1\"");
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Equal("\"2\"", ok.Headers.ETag!.Tag);
        var written = await ok.Json();
        Assert.Equal(2, written.GetProperty("generation").GetInt64());
        Assert.True(written.GetProperty("changed").GetBoolean());

        var rows = await RowsFor(id);
        Assert.Equal(new Rows(Specs: 2, Generation: 2, Outbox: 2, Audit: 3), rows);

        // Weak validator form is accepted too.
        var again = await _client.Put($"/v1/tenants/{id}/spec", new { spec = new { roles = Array.Empty<object>() } }, ifMatch: "W/\"2\"");
        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        Assert.Equal(3, (await again.Json()).GetProperty("generation").GetInt64());
    }

    [Fact]
    public async Task Identical_spec_is_a_no_op_that_writes_nothing()
    {
        var (id, _) = await _client.CreateTenant(spec: new { b = 1, a = new[] { 2, 1 } });
        var before = await RowsFor(id);

        // Same document, different key order and whitespace-insensitive.
        var response = await _client.Put($"/v1/tenants/{id}/spec", new { spec = new { a = new[] { 2, 1 }, b = 1 } }, ifMatch: "\"1\"");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Json();
        Assert.False(body.GetProperty("changed").GetBoolean());
        Assert.Equal(1, body.GetProperty("generation").GetInt64());
        Assert.Equal(before, await RowsFor(id));
    }

    [Fact]
    public async Task A_failure_inside_the_transaction_rolls_back_spec_generation_outbox_and_audit_together()
    {
        var (id, _) = await _client.CreateTenant();
        var before = await RowsFor(id);

        // audit_events.actor is varchar(320). An over-long actor makes the audit
        // INSERT fail inside the same SaveChanges as the spec row, the generation
        // bump and the outbox row. Postgres aborts the statement, EF surfaces the
        // failure, and everything staged in that unit of work must be gone.
        var oversizedActor = new string('a', 400);
        var response = await _client.Put(
            $"/v1/tenants/{id}/spec", new { spec = new { v = 2 } }, ifMatch: "\"1\"", actor: oversizedActor);

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal(before, await RowsFor(id));

        var create = await _client.Post("/v1/tenants", Api.CreateBody(Api.UniqueSlug()), actor: oversizedActor);
        Assert.Equal(HttpStatusCode.InternalServerError, create.StatusCode);
    }

    [Fact]
    public async Task Spec_versions_are_listed_newest_first_and_addressable_by_generation()
    {
        var (id, _) = await _client.CreateTenant(spec: new { v = 1 });
        await _client.Put($"/v1/tenants/{id}/spec", new { spec = new { v = 2 } }, ifMatch: "\"1\"");
        await _client.Put($"/v1/tenants/{id}/spec", new { spec = new { v = 3 } }, ifMatch: "\"2\"");

        var list = await (await _client.GetAsync($"/v1/tenants/{id}/spec/versions")).Json();
        Assert.Equal([3L, 2L, 1L], list.EnumerateArray().Select(v => v.GetProperty("generation").GetInt64()));

        var gen2 = await _client.GetAsync($"/v1/tenants/{id}/spec/versions/2");
        Assert.Equal(HttpStatusCode.OK, gen2.StatusCode);
        Assert.Equal(2, (await gen2.Json()).GetProperty("spec").GetProperty("v").GetInt32());

        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"/v1/tenants/{id}/spec/versions/9")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.GetAsync($"/v1/tenants/{id}/spec/versions/0")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"/v1/tenants/{Guid.NewGuid()}/spec/versions")).StatusCode);
    }

    [Fact]
    public async Task Status_endpoint_and_unknown_tenants()
    {
        var (id, _) = await _client.CreateTenant();

        var status = await _client.GetAsync($"/v1/tenants/{id}/status");
        Assert.Equal(HttpStatusCode.OK, status.StatusCode);
        Assert.Equal("Pending", (await status.Json()).GetProperty("phase").GetString());

        var unknown = await _client.GetAsync($"/v1/tenants/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
        Assert.Equal("application/problem+json", unknown.Content.Headers.ContentType!.MediaType);
    }

    [Fact]
    public async Task List_pages_by_cursor_newest_first_and_filters_by_phase()
    {
        var prefix = Api.UniqueSlug("pg")[..8];
        var ids = new List<Guid>();
        for (var i = 0; i < 3; i++)
        {
            ids.Add((await _client.CreateTenant($"{prefix}-{i}")).Id);
        }

        // Other tests create tenants concurrently, so page through until all three are seen.
        var seen = new List<Guid>();
        string? cursor = null;
        var pages = 0;
        do
        {
            var url = $"/v1/tenants?limit=2" + (cursor is null ? string.Empty : $"&cursor={Uri.EscapeDataString(cursor)}");
            var page = await (await _client.GetAsync(url)).Json();
            var items = page.GetProperty("items").EnumerateArray().ToList();
            Assert.True(items.Count <= 2);
            seen.AddRange(items.Select(i => i.GetProperty("id").GetGuid()));
            cursor = page.GetProperty("nextCursor").ValueKind == System.Text.Json.JsonValueKind.Null
                ? null
                : page.GetProperty("nextCursor").GetString();
            pages++;
        }
        while (cursor is not null && pages < 50);

        Assert.Equal(seen.Count, seen.Distinct().Count());
        Assert.All(ids, id => Assert.Contains(id, seen));

        // Newest first: the last created of ours appears before the first.
        Assert.True(seen.IndexOf(ids[2]) < seen.IndexOf(ids[0]));

        var pending = await (await _client.GetAsync("/v1/tenants?phase=Pending&limit=100")).Json();
        Assert.All(pending.GetProperty("items").EnumerateArray(), i => Assert.Equal("Pending", i.GetProperty("phase").GetString()));

        var none = await (await _client.GetAsync("/v1/tenants?phase=Deleted")).Json();
        Assert.Empty(none.GetProperty("items").EnumerateArray());

        var badPhase = await _client.GetAsync("/v1/tenants?phase=Sideways");
        Assert.Equal(HttpStatusCode.BadRequest, badPhase.StatusCode);

        var garbageCursor = await _client.GetAsync("/v1/tenants?cursor=not-a-cursor");
        Assert.Equal(HttpStatusCode.OK, garbageCursor.StatusCode);
    }
}
