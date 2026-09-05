using System.Text.Json;
using AuthzPlane.Application.Abstractions;
using AuthzPlane.Application.Common;
using AuthzPlane.Domain.Outbox;
using AuthzPlane.Domain.Tenants;

namespace AuthzPlane.Application.Tenants.Commands;

/// <summary>Body of <c>POST /v1/tenants</c>, already parsed at the boundary.</summary>
public sealed record CreateTenantCommand(string Slug, string DisplayName, JsonElement Spec);

public sealed record TenantCreated(Guid TenantId, string Slug, long Generation, string SpecHash);

/// <summary>
/// Creates a tenant at generation 1. Four rows land in one transaction: the
/// tenant, its Pending status, spec version 1 and the outbox message that wakes
/// the reconciler. Nothing external is touched here; the reconciler creates the
/// Zitadel org and FGA store when it picks the message up.
/// </summary>
public sealed class CreateTenantHandler(
    ITenantRepository tenants,
    IOutbox outbox,
    IUnitOfWork unitOfWork,
    IClock clock,
    ICurrentUser currentUser)
{
    public async Task<Result<TenantCreated>> HandleAsync(
        CreateTenantCommand command, CancellationToken cancellationToken = default)
    {
        if (!TenantSlug.TryCreate(command.Slug, out var slug))
        {
            return Errors.Validation(
                "Invalid tenant slug",
                $"Slug must be {TenantSlug.MinLength}-{TenantSlug.MaxLength} lowercase letters, digits or hyphens, " +
                "not starting or ending with a hyphen.");
        }

        if (string.IsNullOrWhiteSpace(command.DisplayName))
        {
            return Errors.Validation("Display name required", "displayName must not be blank.");
        }

        if (command.Spec.ValueKind is not JsonValueKind.Object)
        {
            return Errors.Validation("Invalid spec", "spec must be a JSON object.");
        }

        // Includes soft-deleted tenants on purpose: a deleted tenant still owns
        // its slug in Zitadel and OpenFGA, so reusing it would collide there.
        if (await tenants.SlugExistsAsync(slug, cancellationToken))
        {
            return Errors.Conflict(
                "Slug already taken",
                $"A tenant with slug '{slug}' already exists. Slugs are immutable; choose another.");
        }

        var now = clock.UtcNow;
        var tenantId = Guid.CreateVersion7(now);

        var tenant = Tenant.Create(tenantId, slug, command.DisplayName, now);
        var generation = tenant.BumpGeneration();
        var status = TenantStatus.Create(tenantId, now);
        var spec = TenantSpec.Create(Guid.CreateVersion7(now), tenantId, generation, command.Spec, currentUser.Id, now);

        tenants.Add(tenant);
        tenants.AddStatus(status);
        tenants.AddSpec(spec);
        outbox.Enqueue(SpecWrittenMessage.Create(tenantId, generation, spec.SpecHash, now));

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new TenantCreated(tenantId, slug.Value, generation.Value, spec.SpecHash.Value);
    }
}

/// <summary>Builds the <c>tenant.spec.written</c> message both spec-writing handlers enqueue.</summary>
internal static class SpecWrittenMessage
{
    public static OutboxMessage Create(Guid tenantId, Generation generation, SpecHash specHash, DateTimeOffset now)
    {
        var payload = JsonSerializer.SerializeToElement(new
        {
            tenantId,
            generation = generation.Value,
            specHash = specHash.Value,
        });

        return OutboxMessage.Create(
            Guid.CreateVersion7(now), tenantId, OutboxMessageTypes.TenantSpecWritten, payload, now);
    }
}
