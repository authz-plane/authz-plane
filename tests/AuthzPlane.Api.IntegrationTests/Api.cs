using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using AuthzPlane.Api.Http;
using AuthzPlane.Api.Middleware;

namespace AuthzPlane.Api.IntegrationTests;

/// <summary>Request helpers shared by the test classes. Every mutation carries a fresh Idempotency-Key unless told otherwise.</summary>
internal static class Api
{
    public static string UniqueSlug(string prefix = "t") => $"{prefix}-{Guid.NewGuid():N}"[..20];

    public static object CreateBody(string slug, string displayName = "Test Tenant", object? spec = null) => new
    {
        slug,
        displayName,
        spec = spec ?? new { roles = new[] { new { key = "tenant_admin" } } },
    };

    public static HttpRequestMessage Request(
        HttpMethod method, string path, object? body = null, string? idempotencyKey = null, string? actor = null, string? ifMatch = null)
    {
        var request = new HttpRequestMessage(method, path);
        if (body is not null)
        {
            request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        }

        if (method != HttpMethod.Get)
        {
            request.Headers.Add(IdempotencyMiddleware.HeaderName, idempotencyKey ?? Guid.NewGuid().ToString());
        }

        if (actor is not null)
        {
            request.Headers.Add(HttpCurrentUser.ActorHeader, actor);
        }

        if (ifMatch is not null)
        {
            request.Headers.TryAddWithoutValidation("If-Match", ifMatch);
        }

        return request;
    }

    public static Task<HttpResponseMessage> Post(this HttpClient client, string path, object body, string? key = null, string? actor = null) =>
        client.SendAsync(Request(HttpMethod.Post, path, body, key, actor));

    public static Task<HttpResponseMessage> Put(
        this HttpClient client, string path, object body, string? ifMatch, string? key = null, string? actor = null) =>
        client.SendAsync(Request(HttpMethod.Put, path, body, key, actor, ifMatch));

    public static async Task<JsonElement> Json(this HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>()).Clone();

    /// <summary>Creates a tenant and returns its id and the response body.</summary>
    public static async Task<(Guid Id, JsonElement Body)> CreateTenant(this HttpClient client, string? slug = null, object? spec = null)
    {
        var response = await client.Post("/v1/tenants", CreateBody(slug ?? UniqueSlug(), spec: spec));
        Assert.Equal(System.Net.HttpStatusCode.Created, response.StatusCode);
        var body = await response.Json();
        return (body.GetProperty("id").GetGuid(), body);
    }
}
