using System.Text.Json;
using AuthzPlane.Application.Abstractions;
using AuthzPlane.Domain.Audit;
using AuthzPlane.Domain.Tenants;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace AuthzPlane.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Writes an <see cref="AuditEvent"/> for every audited mutation, in the same
/// <c>SaveChanges</c> as the mutation itself.
/// </summary>
/// <remarks>
/// An interceptor rather than a call in each handler for two reasons. It cannot
/// be forgotten: a new handler that saves a tenant is audited without knowing
/// it. And it is atomic for free: the rows it adds ride the same transaction, so
/// "spec saved but audit missing" and "audit says saved but spec rolled back"
/// are both impossible.
///
/// Day 2 audits tenants and specs. Status transitions are the reconciler's and
/// get their own actions on day 5; tuples and roles follow with their features.
/// </remarks>
public sealed class AuditSaveChangesInterceptor(
    ICurrentUser currentUser,
    IRequestContext requestContext,
    IClock clock) : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        Append(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        Append(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private void Append(DbContext? context)
    {
        if (context is not AuthzPlaneDbContext db)
        {
            return;
        }

        // Handlers mutate aggregates through methods, so nothing is marked
        // Modified until detection runs. Do it once here, explicitly.
        db.ChangeTracker.DetectChanges();

        var now = clock.UtcNow;
        var events = new List<AuditEvent>();

        foreach (var entry in db.ChangeTracker.Entries().ToList())
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified or EntityState.Deleted))
            {
                continue;
            }

            var audit = entry.Entity switch
            {
                Tenant tenant => ForTenant(entry, tenant, now),
                TenantSpec spec when entry.State == EntityState.Added => ForSpec(spec, now),
                _ => null,
            };

            if (audit is not null)
            {
                events.Add(audit);
            }
        }

        if (events.Count > 0)
        {
            db.AuditEvents.AddRange(events);
        }
    }

    private AuditEvent? ForTenant(EntityEntry entry, Tenant tenant, DateTimeOffset now)
    {
        var after = Project(entry.CurrentValues);

        switch (entry.State)
        {
            case EntityState.Added:
                return Record(tenant.Id, AuditActions.TenantCreated, "tenant", tenant.Id.ToString(), null, after, now);

            case EntityState.Modified:
                var before = Project(entry.OriginalValues);
                if (entry.Property(nameof(Tenant.DeletedAt)).IsModified && tenant.DeletedAt is not null)
                {
                    return Record(tenant.Id, AuditActions.TenantDeleteRequested, "tenant", tenant.Id.ToString(), before, after, now);
                }

                if (entry.Property(nameof(Tenant.DisplayName)).IsModified)
                {
                    return Record(tenant.Id, AuditActions.TenantRenamed, "tenant", tenant.Id.ToString(), before, after, now);
                }

                // A bare generation bump is reported by the SpecUpdated row for the
                // new spec version; a second row would say the same thing twice.
                return null;

            default:
                return null;
        }
    }

    private AuditEvent ForSpec(TenantSpec spec, DateTimeOffset now)
    {
        var after = JsonSerializer.SerializeToElement(new
        {
            generation = spec.Generation.Value,
            specHash = spec.SpecHash.Value,
            createdBy = spec.CreatedBy,
        });

        return Record(
            spec.TenantId,
            AuditActions.SpecUpdated,
            "tenant-spec",
            $"{spec.TenantId}/spec/{spec.Generation.Value}",
            null,
            after,
            now);
    }

    private AuditEvent Record(
        Guid tenantId, string action, string resourceType, string resourceId,
        JsonElement? before, JsonElement? after, DateTimeOffset now) =>
        AuditEvent.Record(
            Guid.CreateVersion7(now),
            tenantId,
            currentUser.Id,
            action,
            resourceType,
            resourceId,
            before,
            after,
            now,
            requestContext.RequestId,
            requestContext.TraceId);

    /// <summary>
    /// A stable, small view of a tenant row. Never the entity itself: value
    /// objects and navigation properties do not serialise meaningfully, and the
    /// audit shape should not change every time the entity grows a field.
    /// </summary>
    private static JsonElement Project(PropertyValues values) =>
        JsonSerializer.SerializeToElement(new
        {
            id = values.GetValue<Guid>(nameof(Tenant.Id)),
            slug = values.GetValue<TenantSlug>(nameof(Tenant.Slug)).Value,
            displayName = values.GetValue<string>(nameof(Tenant.DisplayName)),
            generation = values.GetValue<Generation>(nameof(Tenant.Generation)).Value,
            deletedAt = values.GetValue<DateTimeOffset?>(nameof(Tenant.DeletedAt)),
        });
}
