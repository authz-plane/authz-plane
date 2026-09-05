using AuthzPlane.Api.Workers;
using AuthzPlane.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddProblemDetails();
builder.Services.AddHealthChecks();

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

app.UseExceptionHandler();
app.UseStatusCodePages();

// Liveness: the process is up. Deliberately does NOT touch the database - a
// failing dependency should not cause Kubernetes to restart a healthy process.
app.MapHealthChecks("/healthz");

// Readiness: safe to receive traffic. Dependency checks land on day 2 with the
// real DB check.
app.MapHealthChecks("/readyz");

app.MapGet("/", () => Results.Ok(new
{
    service = "authz-plane",
    status = "scaffold",
    docs = "/docs/system-design.md",
}));

app.Run();

/// <summary>Exposed so integration tests can drive the host with WebApplicationFactory.</summary>
public partial class Program;
