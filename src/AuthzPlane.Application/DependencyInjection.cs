using AuthzPlane.Application.Tenants.Commands;
using Microsoft.Extensions.DependencyInjection;

namespace AuthzPlane.Application;

public static class DependencyInjection
{
    /// <summary>
    /// Registers use-case handlers. Plain classes, one per command: no mediator,
    /// so a handler's dependencies are visible in its constructor and the call
    /// path from endpoint to handler is a single method call in a stack trace.
    /// </summary>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<CreateTenantHandler>();
        services.AddScoped<UpdateTenantSpecHandler>();
        return services;
    }
}
