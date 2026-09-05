using System.Reflection;
using System.Text;
using AuthzPlane.Application.Abstractions;
using AuthzPlane.Domain.Audit;
using AuthzPlane.Domain.Authorization;
using AuthzPlane.Domain.Outbox;
using AuthzPlane.Domain.Reconciliation;
using AuthzPlane.Domain.Tenants;
using AuthzPlane.Infrastructure.Idempotency;
using Microsoft.EntityFrameworkCore;

namespace AuthzPlane.Infrastructure.Persistence;

/// <summary>
/// Control-plane database. Postgres only: the design leans on jsonb, partial
/// indexes and advisory locks, none of which are portable.
/// </summary>
public sealed class AuthzPlaneDbContext(
    DbContextOptions<AuthzPlaneDbContext> options,
    ICurrentTenant currentTenant)
    : DbContext(options), IUnitOfWork
{
    private readonly ICurrentTenant _currentTenant = currentTenant;

    /// <summary>
    /// Tenant scope for the global query filters.
    /// </summary>
    /// <remarks>
    /// This property exists for one specific reason, and removing it is a
    /// cross-tenant data leak that passes every unit test.
    ///
    /// Query filters are compiled into the EF model, and the model is cached and
    /// shared across every context instance in the process. A filter written as
    /// <c>e =&gt; e.TenantId == _currentTenant.TenantId</c> captures the service
    /// instance belonging to whichever request happened to build the model
    /// first, and every subsequent request silently reuses that tenant id.
    ///
    /// Referencing an instance property on the DbContext instead makes EF
    /// re-evaluate it per context instance. So filters MUST say
    /// <c>== CurrentTenantId</c>. Do not inline the service access.
    /// </remarks>
    public Guid? CurrentTenantId => _currentTenant.TenantId;

    public DbSet<Tenant> Tenants => Set<Tenant>();

    public DbSet<TenantSpec> TenantSpecs => Set<TenantSpec>();

    public DbSet<TenantStatus> TenantStatuses => Set<TenantStatus>();

    public DbSet<ReconcileRun> ReconcileRuns => Set<ReconcileRun>();

    public DbSet<ReconcileChange> ReconcileChanges => Set<ReconcileChange>();

    public DbSet<DriftFinding> DriftFindings => Set<DriftFinding>();

    public DbSet<RelationTuple> RelationTuples => Set<RelationTuple>();

    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();

    public DbSet<IdempotencyRecord> IdempotencyRecords => Set<IdempotencyRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
        ApplyTenantIsolation(modelBuilder);
        ApplySnakeCaseNames(modelBuilder);
    }


    /// <summary>
    /// Global query filters for tenant isolation - layer 1 of the three in
    /// section 8.5.
    /// </summary>
    /// <remarks>
    /// Written out one line per entity on purpose. Registering these by
    /// reflection over <see cref="Domain.Common.ITenantScoped"/> looks tidier
    /// but binds the expression to the interface property, which EF's query
    /// translator cannot map to the concrete column. The cost of writing them
    /// by hand is that one can be forgotten, so
    /// <c>Every_tenant_scoped_entity_has_a_query_filter</c> walks the built
    /// model and fails the build if any is missing. Forgetting is a red build,
    /// not a data leak.
    ///
    /// When CurrentTenantId is null the filters match nothing: default-deny.
    /// Platform-admin queries must opt out explicitly with IgnoreQueryFilters().
    /// </remarks>
    private void ApplyTenantIsolation(ModelBuilder modelBuilder)
    {
        // Not tenant-scoped: soft-delete filter only.
        modelBuilder.Entity<Tenant>().HasQueryFilter(t => t.DeletedAt == null);

        modelBuilder.Entity<TenantSpec>().HasQueryFilter(e => e.TenantId == CurrentTenantId);
        modelBuilder.Entity<TenantStatus>().HasQueryFilter(e => e.TenantId == CurrentTenantId);
        modelBuilder.Entity<ReconcileRun>().HasQueryFilter(e => e.TenantId == CurrentTenantId);
        modelBuilder.Entity<DriftFinding>().HasQueryFilter(e => e.TenantId == CurrentTenantId);
        modelBuilder.Entity<RelationTuple>().HasQueryFilter(e => e.TenantId == CurrentTenantId);
        modelBuilder.Entity<OutboxMessage>().HasQueryFilter(e => e.TenantId == CurrentTenantId);
        modelBuilder.Entity<AuditEvent>().HasQueryFilter(e => e.TenantId == CurrentTenantId);

        // IdempotencyRecord is keyed by (actor, key), not by tenant: a caller's
        // retry must replay regardless of which tenant the request addressed.

        // ReconcileChange is deliberately NOT tenant-scoped: it has no tenant_id
        // column and is only reachable by joining through reconcile_runs, which
        // is filtered. Adding a tenant_id here would be denormalisation with a
        // second source of truth.
    }

    /// <summary>
    /// Postgres convention. Done here rather than by hand on every property so
    /// that a new entity cannot quietly arrive with PascalCase columns.
    /// </summary>
    private static void ApplySnakeCaseNames(ModelBuilder modelBuilder)
    {
        foreach (var entity in modelBuilder.Model.GetEntityTypes())
        {
            var tableName = entity.GetTableName();
            if (tableName is not null)
            {
                entity.SetTableName(ToSnakeCase(tableName));
            }

            foreach (var property in entity.GetProperties())
            {
                property.SetColumnName(ToSnakeCase(property.GetColumnName()));
            }

            foreach (var key in entity.GetKeys())
            {
                key.SetName(ToSnakeCase(key.GetName()!));
            }

            foreach (var fk in entity.GetForeignKeys())
            {
                fk.SetConstraintName(ToSnakeCase(fk.GetConstraintName()!));
            }

            foreach (var index in entity.GetIndexes())
            {
                index.SetDatabaseName(ToSnakeCase(index.GetDatabaseName()!));
            }
        }
    }

    internal static string ToSnakeCase(string name)
    {
        if (string.IsNullOrEmpty(name))
        {
            return name;
        }

        var builder = new StringBuilder(name.Length + 8);
        for (var i = 0; i < name.Length; i++)
        {
            var c = name[i];
            if (!char.IsUpper(c))
            {
                builder.Append(c);
                continue;
            }

            // Underscore before an upper char only at a real word boundary:
            // after a lower/digit, or at the end of an acronym run such as the
            // "IX" in EF's IX_DriftFindings_RunId. Without the acronym case
            // that name becomes "i_x_drift_findings_run_id".
            var prev = i > 0 ? name[i - 1] : default;
            var next = i + 1 < name.Length ? name[i + 1] : default;
            var boundary = i > 0 && prev != '_' &&
                           (char.IsLower(prev) || char.IsDigit(prev) ||
                            (char.IsUpper(prev) && char.IsLower(next)));

            if (boundary)
            {
                builder.Append('_');
            }

            builder.Append(char.ToLowerInvariant(c));
        }

        return builder.ToString();
    }
}
