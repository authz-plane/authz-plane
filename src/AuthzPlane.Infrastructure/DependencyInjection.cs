using AuthzPlane.Application.Abstractions;
using AuthzPlane.Application.Tenants;
using AuthzPlane.Infrastructure.Persistence;
using AuthzPlane.Infrastructure.Time;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AuthzPlane.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("ControlPlane")
            ?? throw new InvalidOperationException(
                "ConnectionStrings:ControlPlane is not configured.");

        services.AddDbContext<AuthzPlaneDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql =>
                {
                    npgsql.MigrationsHistoryTable("__ef_migrations_history");
                    npgsql.EnableRetryOnFailure(maxRetryCount: 3);
                })
                // Reads never need change tracking; writes opt in per repository.
                .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking));

        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<IClock, SystemClock>();

        // One instance serving both roles: the setter mutates the async-local
        // that the reader observes.
        services.AddSingleton<AmbientTenant>();
        services.AddSingleton<ICurrentTenant>(sp => sp.GetRequiredService<AmbientTenant>());
        services.AddSingleton<ITenantScopeSetter>(sp => sp.GetRequiredService<AmbientTenant>());

        services.AddScoped<ITenantRepository, TenantRepository>();
        services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<AuthzPlaneDbContext>());

        return services;
    }
}
