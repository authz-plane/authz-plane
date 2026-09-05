using AuthzPlane.Application.Abstractions;

namespace AuthzPlane.Infrastructure.Persistence;

/// <summary>
/// Tenant scope held in an async-local, so a worker can set it for one
/// iteration and a request pipeline can set it per request.
/// </summary>
/// <remarks>
/// AsyncLocal rather than a scoped service because the reconciler processes
/// tenants in a loop inside one DI scope, and each iteration needs its own
/// scope without rebuilding the container.
/// </remarks>
public sealed class AmbientTenant : ICurrentTenant, ITenantScopeSetter
{
    private static readonly AsyncLocal<Guid?> Current = new();

    public Guid? TenantId => Current.Value;

    public IDisposable Enter(Guid tenantId)
    {
        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("Tenant id cannot be empty.", nameof(tenantId));
        }

        var previous = Current.Value;
        Current.Value = tenantId;
        return new Scope(previous);
    }

    private sealed class Scope(Guid? previous) : IDisposable
    {
        private bool _disposed;

        public void Dispose()
        {
            if (_disposed)
            {
                return;
            }

            Current.Value = previous;
            _disposed = true;
        }
    }
}
