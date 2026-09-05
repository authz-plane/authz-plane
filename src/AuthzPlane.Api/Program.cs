using System.Diagnostics.CodeAnalysis;
using System.Reflection;
using System.Text.Json.Serialization;
using AuthzPlane.Api.Endpoints;
using AuthzPlane.Api.Http;
using AuthzPlane.Api.Middleware;
using AuthzPlane.Api.Workers;
using AuthzPlane.Application;
using AuthzPlane.Application.Abstractions;
using AuthzPlane.Infrastructure;
using AuthzPlane.Infrastructure.Persistence;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;

namespace AuthzPlane.Api;

/// <summary>
/// Host entry point. Public so integration tests can drive it with
/// <c>WebApplicationFactory&lt;Program&gt;</c>.
/// </summary>
[ExcludeFromCodeCoverage]
public class Program
{
    /// <summary>
    /// Main method that configures and runs the web application.
    /// </summary>
    /// <param name="args">Command line arguments.</param>
    public static async Task Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        // HTTP-backed identity must be registered before AddInfrastructure, which
        // TryAdds worker-role defaults for the same interfaces.
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();
        builder.Services.AddScoped<IRequestContext, HttpRequestContext>();

        builder.Services.AddApplication();
        builder.Services.AddInfrastructure(builder.Configuration);
        builder.Services.AddProblemDetails();

        // Phases and outcomes travel as their names ("Degraded"), never as
        // ordinals: the console colours by name and the audit log must stay
        // readable if an enum member is ever reordered.
        builder.Services.ConfigureHttpJsonOptions(options =>
            options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
        builder.Services.AddOpenApi();

        builder.Services.AddHealthChecks()
            .AddDbContextCheck<AuthzPlaneDbContext>("postgres", tags: ["ready"]);

        // ADR-011: one image, two runtime roles. The API deployment runs with
        // Workers:Enabled=false and takes ingress; the reconciler deployment runs the
        // same image with Workers:Enabled=true and has probes only. Two deployments,
        // one artefact, four projects.
        //
        // Accepted cost: if both deployments set Workers:Enabled=true, two loops race.
        // That is safe - the per-tenant advisory lock makes the second a no-op - but it
        // is wasted work. The Helm chart owns this invariant.
        if (builder.Configuration.GetValue("Workers:Enabled", false))
        {
            builder.Services.AddHostedService<ReconcileWorker>();
        }

        var app = builder.Build();

        // Malformed input (unparseable query values, invalid JSON bodies) surfaces
        // as BadHttpRequestException. Keep its 4xx instead of flattening to 500.
        app.UseExceptionHandler(new ExceptionHandlerOptions
        {
            StatusCodeSelector = ex => ex is BadHttpRequestException bad
                ? bad.StatusCode
                : StatusCodes.Status500InternalServerError,
        });
        app.UseStatusCodePages();

        // Liveness: the process is up. Deliberately runs no checks - a failing
        // dependency should not cause Kubernetes to restart a healthy process.
        app.MapHealthChecks("/healthz", new HealthCheckOptions { Predicate = _ => false });

        // Readiness: safe to receive traffic. Opens a database connection.
        app.MapHealthChecks("/readyz", new HealthCheckOptions { Predicate = r => r.Tags.Contains("ready") });

        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi();
        }

        app.UseMiddleware<IdempotencyMiddleware>();

        app.MapGet("/", () => Results.Ok(new
        {
            service = "authz-plane",
            docs = "/docs/system-design.md",
            openapi = "/openapi/v1.json",
        }));

        app.MapGet("/v1/version", () => Results.Ok(new
        {
            version = Assembly.GetExecutingAssembly()
                .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "0.0.0-dev",
        })).WithName("GetVersion");

        app.MapTenantEndpoints();

        await app.RunAsync();
    }
}
