using AuthzPlane.Application.Abstractions;
using AuthzPlane.Application.Tenants;
using AuthzPlane.Domain.Outbox;
using AuthzPlane.Domain.Tenants;

namespace AuthzPlane.Application.UnitTests;

/// <summary>
/// Hand-written fakes rather than a mocking library: the ports are small, and a
/// fake that behaves like the real thing (soft-delete filter, slug check
/// ignoring it) catches more than a mock that returns what the test expects.
/// </summary>
internal sealed class InMemoryTenantRepository : ITenantRepository
{
    public List<Tenant> Tenants { get; } = [];

    public List<TenantStatus> Statuses { get; } = [];

    public List<TenantSpec> Specs { get; } = [];

    public Task<Tenant?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(Tenants.FirstOrDefault(t => t.Id == id && !t.IsDeleted));

    public Task<Tenant?> FindBySlugAsync(TenantSlug slug, CancellationToken cancellationToken = default) =>
        Task.FromResult(Tenants.FirstOrDefault(t => t.Slug == slug && !t.IsDeleted));

    public Task<bool> SlugExistsAsync(TenantSlug slug, CancellationToken cancellationToken = default) =>
        Task.FromResult(Tenants.Any(t => t.Slug == slug));

    public Task<TenantStatus?> FindStatusAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
        Task.FromResult(Statuses.FirstOrDefault(s => s.TenantId == tenantId));

    public Task<TenantSpec?> FindLatestSpecAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
        Task.FromResult(Specs.Where(s => s.TenantId == tenantId).OrderByDescending(s => s.Generation).FirstOrDefault());

    public void Add(Tenant tenant) => Tenants.Add(tenant);

    public void AddStatus(TenantStatus status) => Statuses.Add(status);

    public void AddSpec(TenantSpec spec) => Specs.Add(spec);
}

internal sealed class FakeOutbox : IOutbox
{
    public List<OutboxMessage> Messages { get; } = [];

    public void Enqueue(OutboxMessage message) => Messages.Add(message);
}

internal sealed class FakeUnitOfWork : IUnitOfWork
{
    public int SaveCount { get; private set; }

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        SaveCount++;
        return Task.FromResult(1);
    }
}

internal sealed class FixedClock(DateTimeOffset now) : IClock
{
    public DateTimeOffset UtcNow { get; set; } = now;
}

internal sealed class FakeUser(string id, bool isSystem = false) : ICurrentUser
{
    public string Id => id;

    public bool IsSystem => isSystem;
}

internal sealed class RecordingScopeSetter : ITenantScopeSetter
{
    public List<Guid> Entered { get; } = [];

    public int Open { get; private set; }

    public IDisposable Enter(Guid tenantId)
    {
        Entered.Add(tenantId);
        Open++;
        return new Exit(this);
    }

    private sealed class Exit(RecordingScopeSetter owner) : IDisposable
    {
        public void Dispose() => owner.Open--;
    }
}
