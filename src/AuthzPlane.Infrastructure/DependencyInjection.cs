using AuthzPlane.Application.Abstractions;
using AuthzPlane.Application.Tenants;
using AuthzPlane.Application.Tenants.Queries;
using AuthzPlane.Infrastructure.Idempotency;
using AuthzPlane.Infrastructure.Identity;
using AuthzPlane.Infrastructure.Persistence;
using AuthzPlane.Infrastructure.Persistence.Interceptors;
using AuthzPlane.Infrastructure.Persistence.Queries;
using AuthzPlane.Infrastructure.Time;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace AuthzPlane.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("ControlPlane")
            ?? throw new InvalidOperationException(
                "ConnectionStrings:ControlPlane is not configured.");

        services.AddScoped<AuditSaveChangesInterceptor>();

        services.AddDbContext<AuthzPlaneDbContext>((provider, options) =>
            options.UseNpgsql(connectionString, npgsql =>
                {
                    npgsql.MigrationsHistoryTable("__ef_migrations_history");
                    npgsql.EnableRetryOnFailure(maxRetryCount: 3);
                })
                // Reads never need change tracking; writes opt in per repository.
                .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking)
                // Resolved from the scope so the interceptor sees the request's user.
                .AddInterceptors(provider.GetRequiredService<AuditSaveChangesInterceptor>()));

        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<IClock, SystemClock>();

        // One instance serving both roles: the setter mutates the async-local
        // that the reader observes.
        services.AddSingleton<AmbientTenant>();
        services.AddSingleton<ICurrentTenant>(sp => sp.GetRequiredService<AmbientTenant>());
        services.AddSingleton<ITenantScopeSetter>(sp => sp.GetRequiredService<AmbientTenant>());

        // Worker-role defaults. The API registers HTTP-backed implementations
        // before calling this, and TryAdd leaves those in place.
        services.TryAddScoped<ICurrentUser, SystemUser>();
        services.TryAddSingleton<IRequestContext, NullRequestContext>();

        services.AddScoped<ITenantRepository, TenantRepository>();
        services.AddScoped<ITenantQueries, TenantQueries>();
        services.AddScoped<IOutbox, OutboxRepository>();
        services.AddScoped<IIdempotencyStore, IdempotencyStore>();
        services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<AuthzPlaneDbContext>());

        return services;
    }
}
