using System.Text.Json;
using AuthzPlane.Application.Abstractions;
using AuthzPlane.Application.Common;
using AuthzPlane.Domain.Tenants;

namespace AuthzPlane.Application.Tenants.Commands;

/// <summary>
/// <c>PUT /v1/tenants/{id}/spec</c>. <paramref name="ExpectedGeneration"/> is the
/// parsed <c>If-Match</c> header; null means the caller did not send one.
/// </summary>
public sealed record UpdateTenantSpecCommand(Guid TenantId, long? ExpectedGeneration, JsonElement Spec);

/// <summary><c>Changed</c> is false when the spec matched the current version and nothing was written.</summary>
public sealed record SpecWritten(Guid TenantId, long Generation, string SpecHash, bool Changed);

/// <summary>
/// Appends a new immutable spec version and bumps the tenant's generation.
/// </summary>
/// <remarks>
/// <c>If-Match</c> is mandatory. Two operators editing the same spec would
/// otherwise silently overwrite each other; with it, the second one gets a 412
/// carrying the current generation and can re-diff. A spec whose canonical hash
/// equals the current version is a no-op: no row, no generation bump, no
/// reconcile. That keeps "save without changes" from waking the reconciler.
/// </remarks>
public sealed class UpdateTenantSpecHandler(
    ITenantRepository tenants,
    IOutbox outbox,
    IUnitOfWork unitOfWork,
    IClock clock,
    ICurrentUser currentUser,
    ITenantScopeSetter tenantScope)
{
    public async Task<Result<SpecWritten>> HandleAsync(
        UpdateTenantSpecCommand command, CancellationToken cancellationToken = default)
    {
        if (command.Spec.ValueKind is not JsonValueKind.Object)
        {
            return Errors.Validation("Invalid spec", "spec must be a JSON object.");
        }

        if (command.ExpectedGeneration is null)
        {
            return Errors.PreconditionRequired(
                "If-Match required",
                "Send If-Match: <generation> with the generation you edited from, so a concurrent edit is detected.");
        }

        var tenant = await tenants.FindByIdAsync(command.TenantId, cancellationToken);
        if (tenant is null)
        {
            return Errors.NotFound("Tenant not found", $"No tenant with id {command.TenantId}.");
        }

        // Spec rows are tenant-scoped; the query filter needs the scope set
        // even when the caller is a platform operator hitting the API.
        using var scope = tenantScope.Enter(tenant.Id);

        if (tenant.Generation.Value != command.ExpectedGeneration.Value)
        {
            return Errors.PreconditionFailed(
                "Spec changed underneath you",
                $"If-Match was {command.ExpectedGeneration} but the tenant is at generation {tenant.Generation}. " +
                "Reload, re-diff and resubmit.",
                new Dictionary<string, object?> { ["currentGeneration"] = tenant.Generation.Value });
        }

        var latest = await tenants.FindLatestSpecAsync(tenant.Id, cancellationToken);
        if (latest is not null && latest.Matches(command.Spec))
        {
            return new SpecWritten(tenant.Id, tenant.Generation.Value, latest.SpecHash.Value, Changed: false);
        }

        var now = clock.UtcNow;
        var generation = tenant.BumpGeneration();
        var spec = TenantSpec.Create(Guid.CreateVersion7(now), tenant.Id, generation, command.Spec, currentUser.Id, now);

        tenants.AddSpec(spec);
        outbox.Enqueue(SpecWrittenMessage.Create(tenant.Id, generation, spec.SpecHash, now));

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new SpecWritten(tenant.Id, generation.Value, spec.SpecHash.Value, Changed: true);
    }
}
