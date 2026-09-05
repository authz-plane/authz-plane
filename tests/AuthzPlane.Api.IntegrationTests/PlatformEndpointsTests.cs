using System.Net;

namespace AuthzPlane.Api.IntegrationTests;

public sealed class PlatformEndpointsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Liveness_and_readiness_are_healthy_with_a_database()
    {
        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync("/healthz")).StatusCode);

        var ready = await _client.GetAsync("/readyz");
        Assert.Equal(HttpStatusCode.OK, ready.StatusCode);
        Assert.Equal("Healthy", await ready.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task OpenApi_document_lists_the_tenant_routes()
    {
        var response = await _client.GetAsync("/openapi/v1.json");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var doc = await response.Json();
        var paths = doc.GetProperty("paths").EnumerateObject().Select(p => p.Name).ToList();
        Assert.Contains("/v1/tenants", paths);
        Assert.Contains("/v1/tenants/{id}", paths);
        Assert.Contains("/v1/tenants/{id}/spec", paths);
        Assert.Contains("/v1/tenants/{id}/spec/versions/{generation}", paths);
    }

    [Fact]
    public async Task Version_endpoint_answers()
    {
        var response = await _client.GetAsync("/v1/version");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(string.IsNullOrEmpty((await response.Json()).GetProperty("version").GetString()));
    }
}
