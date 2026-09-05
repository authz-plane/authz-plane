using AuthzPlane.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;

namespace AuthzPlane.Api.IntegrationTests;

/// <summary>
/// One API host and one Postgres per test run.
/// </summary>
/// <remarks>
/// Testcontainers by default, so CI and a fresh laptop need only Docker. Set
/// <c>AUTHZPLANE_TEST_PG</c> to a connection string to reuse a running database
/// instead (e.g. the compose Postgres on 5433) and skip the container start.
/// Migrations are applied once here, so every test sees the schema the
/// committed migration script produces.
/// </remarks>
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private const string OverrideVariable = "AUTHZPLANE_TEST_PG";

    private readonly PostgreSqlContainer? _container;
    private string _connectionString = string.Empty;

    public ApiFactory()
    {
        var external = Environment.GetEnvironmentVariable(OverrideVariable);
        if (string.IsNullOrWhiteSpace(external))
        {
            _container = new PostgreSqlBuilder("postgres:17-alpine")
                .WithDatabase("authzplane_test")
                .WithUsername("test")
                .WithPassword("test")
                .Build();
        }
        else
        {
            _connectionString = external;
        }
    }

    // xunit 2.x's IAsyncLifetime returns Task while WebApplicationFactory's
    // IAsyncDisposable returns ValueTask, so the xunit members are implemented
    // explicitly and delegate to the ValueTask-returning ones.
    async Task IAsyncLifetime.InitializeAsync()
    {
        if (_container is not null)
        {
            await _container.StartAsync();
            _connectionString = _container.GetConnectionString();
        }

        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AuthzPlaneDbContext>();
        await db.Database.MigrateAsync();
    }

    Task IAsyncLifetime.DisposeAsync() => DisposeAsync().AsTask();

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        if (_container is not null)
        {
            await _container.DisposeAsync();
        }
    }

    /// <summary>A scoped DbContext for asserting on rows. Callers must IgnoreQueryFilters: no tenant scope is set here.</summary>
    public AsyncServiceScope CreateScope() => Services.CreateAsyncScope();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("ConnectionStrings:ControlPlane", _connectionString);
        builder.UseSetting("Workers:Enabled", "false");
    }
}
