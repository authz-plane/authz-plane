using AuthzPlane.Application.Abstractions;
using AuthzPlane.Domain.Common;
using AuthzPlane.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthzPlane.Architecture.Tests;

/// <summary>
/// Layer 1 of the isolation story in section 8.5, checked against the built EF
/// model rather than against the source.
/// </summary>
public sealed class TenantIsolationTests
{
    private sealed class StubTenant : ICurrentTenant
    {
        public Guid? TenantId => Guid.Empty;
    }

    /// <summary>Builds the model without touching a database.</summary>
    private static AuthzPlaneDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AuthzPlaneDbContext>()
            .UseNpgsql("Host=localhost;Database=model_only;Username=x;Password=y")
            .Options;

        return new AuthzPlaneDbContext(options, new StubTenant());
    }

    /// <summary>
    /// The test that makes forgetting a filter a build failure instead of a
    /// cross-tenant data leak discovered in production.
    /// </summary>
    [Fact]
    public void Every_tenant_scoped_entity_has_a_query_filter()
    {
        using var context = CreateContext();
        var model = context.Model;

        var missing = model.GetEntityTypes()
            .Where(e => e.ClrType.IsAssignableTo(typeof(ITenantScoped)))
            .Where(e => e.GetDeclaredQueryFilters().Count == 0)
            .Select(e => e.ClrType.Name)
            .OrderBy(n => n)
            .ToList();

        Assert.True(
            missing.Count == 0,
            "ITenantScoped entities without a global query filter: " +
            string.Join(", ", missing) +
            ". Add one in AuthzPlaneDbContext.ApplyTenantIsolation, referencing " +
            "CurrentTenantId (never the ICurrentTenant service directly).");
    }

    [Fact]
    public void At_least_one_entity_is_tenant_scoped()
    {
        // Guards against the previous test passing vacuously if the marker
        // interface is ever renamed or the model stops being discovered.
        using var context = CreateContext();

        var scoped = context.Model.GetEntityTypes()
            .Count(e => e.ClrType.IsAssignableTo(typeof(ITenantScoped)));

        Assert.True(scoped > 0, "No ITenantScoped entities found in the model at all.");
    }

    [Fact]
    public void Every_tenant_scoped_entity_indexes_tenant_id_first()
    {
        // Section 8.4: every tenant-scoped index leads with tenant_id, so the
        // planner can use it for the tenant-filtered queries that are the only
        // ones the query filter permits.
        using var context = CreateContext();

        var offenders = new List<string>();
        foreach (var entity in context.Model.GetEntityTypes()
                     .Where(e => e.ClrType.IsAssignableTo(typeof(ITenantScoped))))
        {
            foreach (var index in entity.GetIndexes())
            {
                var first = index.Properties[0].Name;
                if (index.Properties.Count > 1 && first != nameof(ITenantScoped.TenantId))
                {
                    offenders.Add($"{entity.ClrType.Name}.{index.GetDatabaseName()} leads with {first}");
                }
            }
        }

        Assert.True(offenders.Count == 0, string.Join("; ", offenders));
    }
}
