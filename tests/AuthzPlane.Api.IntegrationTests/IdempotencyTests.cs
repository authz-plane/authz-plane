using System.Net;
using AuthzPlane.Api.Middleware;
using AuthzPlane.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AuthzPlane.Api.IntegrationTests;

public sealed class IdempotencyTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Mutations_without_a_key_are_rejected_and_reads_do_not_need_one()
    {
        var request = Api.Request(HttpMethod.Post, "/v1/tenants", Api.CreateBody(Api.UniqueSlug()));
        request.Headers.Remove(IdempotencyMiddleware.HeaderName);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("Idempotency-Key required", (await response.Json()).GetProperty("title").GetString());

        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync("/v1/tenants")).StatusCode);
    }

    [Fact]
    public async Task Replaying_the_same_request_returns_the_stored_response_and_creates_nothing_new()
    {
        var slug = Api.UniqueSlug();
        var key = Guid.NewGuid().ToString();
        var body = Api.CreateBody(slug);

        var first = await _client.Post("/v1/tenants", body, key);
        var second = await _client.Post("/v1/tenants", body, key);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        Assert.False(first.Headers.Contains(IdempotencyMiddleware.ReplayedHeader));
        Assert.Equal("true", second.Headers.GetValues(IdempotencyMiddleware.ReplayedHeader).Single());
        Assert.Equal(await first.Content.ReadAsStringAsync(), await second.Content.ReadAsStringAsync());

        await using var scope = factory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AuthzPlaneDbContext>();
        Assert.Equal(1, await db.Tenants.IgnoreQueryFilters().CountAsync(t => t.Slug == Domain.Tenants.TenantSlug.Create(slug)));
    }

    [Fact]
    public async Task Same_key_with_a_different_body_is_unprocessable()
    {
        var key = Guid.NewGuid().ToString();
        await _client.Post("/v1/tenants", Api.CreateBody(Api.UniqueSlug()), key);

        var response = await _client.Post("/v1/tenants", Api.CreateBody(Api.UniqueSlug()), key);

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Equal("Idempotency-Key reused", (await response.Json()).GetProperty("title").GetString());
    }

    [Fact]
    public async Task Keys_are_scoped_per_actor()
    {
        var key = Guid.NewGuid().ToString();
        var a = await _client.Post("/v1/tenants", Api.CreateBody(Api.UniqueSlug()), key, actor: "alice@example.test");
        var b = await _client.Post("/v1/tenants", Api.CreateBody(Api.UniqueSlug()), key, actor: "bob@example.test");

        Assert.Equal(HttpStatusCode.Created, a.StatusCode);
        Assert.Equal(HttpStatusCode.Created, b.StatusCode);
    }

    [Fact]
    public async Task Error_responses_are_replayed_too()
    {
        var key = Guid.NewGuid().ToString();
        var body = Api.CreateBody("Bad Slug");

        var first = await _client.Post("/v1/tenants", body, key);
        var second = await _client.Post("/v1/tenants", body, key);

        Assert.Equal(HttpStatusCode.BadRequest, first.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
        Assert.Equal("true", second.Headers.GetValues(IdempotencyMiddleware.ReplayedHeader).Single());
    }

    [Fact]
    public async Task Over_long_keys_are_rejected()
    {
        var response = await _client.Post("/v1/tenants", Api.CreateBody(Api.UniqueSlug()), new string('k', 129));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
