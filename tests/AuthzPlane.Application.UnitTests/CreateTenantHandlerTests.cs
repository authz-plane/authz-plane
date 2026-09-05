using System.Text.Json;
using AuthzPlane.Application.Common;
using AuthzPlane.Application.Tenants.Commands;
using AuthzPlane.Domain.Outbox;
using AuthzPlane.Domain.Tenants;

namespace AuthzPlane.Application.UnitTests;

public sealed class CreateTenantHandlerTests
{
    private static readonly DateTimeOffset T0 = new(2026, 9, 4, 10, 15, 0, TimeSpan.Zero);

    private readonly InMemoryTenantRepository _repo = new();
    private readonly FakeOutbox _outbox = new();
    private readonly FakeUnitOfWork _uow = new();
    private readonly CreateTenantHandler _handler;

    public CreateTenantHandlerTests()
    {
        _handler = new CreateTenantHandler(_repo, _outbox, _uow, new FixedClock(T0), new FakeUser("ops@example.test"));
    }

    private static JsonElement Spec(string json = """{"roles":[{"key":"tenant_admin"}]}""") =>
        JsonDocument.Parse(json).RootElement.Clone();

    [Fact]
    public async Task Creates_tenant_status_spec_and_outbox_in_one_save()
    {
        var result = await _handler.HandleAsync(new CreateTenantCommand("acme-air", " Acme Air ", Spec()));

        Assert.True(result.IsSuccess);
        var created = result.Value;
        Assert.Equal("acme-air", created.Slug);
        Assert.Equal(1, created.Generation);

        var tenant = Assert.Single(_repo.Tenants);
        Assert.Equal(created.TenantId, tenant.Id);
        Assert.Equal("Acme Air", tenant.DisplayName);
        Assert.Equal(Generation.First, tenant.Generation);
        Assert.Equal(T0, tenant.CreatedAt);

        var status = Assert.Single(_repo.Statuses);
        Assert.Equal(tenant.Id, status.TenantId);
        Assert.Equal(TenantPhase.Pending, status.Phase);
        Assert.Equal(Generation.None, status.ObservedGeneration);

        var spec = Assert.Single(_repo.Specs);
        Assert.Equal(Generation.First, spec.Generation);
        Assert.Equal("ops@example.test", spec.CreatedBy);
        Assert.Equal(created.SpecHash, spec.SpecHash.Value);

        var message = Assert.Single(_outbox.Messages);
        Assert.Equal(OutboxMessageTypes.TenantSpecWritten, message.Type);
        Assert.Equal(tenant.Id, message.TenantId);
        using var payload = JsonDocument.Parse(message.Payload);
        Assert.Equal(tenant.Id, payload.RootElement.GetProperty("tenantId").GetGuid());
        Assert.Equal(1, payload.RootElement.GetProperty("generation").GetInt64());
        Assert.Equal(created.SpecHash, payload.RootElement.GetProperty("specHash").GetString());

        Assert.Equal(1, _uow.SaveCount);
    }

    [Fact]
    public async Task Spec_is_stored_canonically_so_the_hash_and_bytes_agree()
    {
        var result = await _handler.HandleAsync(new CreateTenantCommand("acme-air", "Acme", Spec("""{ "b": 1,  "a": [2, 1] }""")));

        var spec = Assert.Single(_repo.Specs);
        Assert.Equal("""{"a":[2,1],"b":1}""", spec.SpecJson);
        Assert.Equal(SpecHash.Of(spec.SpecJson).Value, result.Value.SpecHash);
    }

    [Theory]
    [InlineData("Acme Air")]
    [InlineData("ab")]
    [InlineData("-acme")]
    [InlineData("")]
    public async Task Rejects_invalid_slugs_before_touching_the_repository(string slug)
    {
        var result = await _handler.HandleAsync(new CreateTenantCommand(slug, "Acme", Spec()));

        Assert.True(result.IsFailure);
        Assert.Equal(ErrorKind.Validation, result.Error!.Kind);
        Assert.Empty(_repo.Tenants);
        Assert.Equal(0, _uow.SaveCount);
    }

    [Fact]
    public async Task Rejects_blank_display_name_and_non_object_spec()
    {
        var blank = await _handler.HandleAsync(new CreateTenantCommand("acme-air", "  ", Spec()));
        Assert.Equal(ErrorKind.Validation, blank.Error!.Kind);

        var array = await _handler.HandleAsync(new CreateTenantCommand("acme-air", "Acme", Spec("[1]")));
        Assert.Equal(ErrorKind.Validation, array.Error!.Kind);

        Assert.Equal(0, _uow.SaveCount);
    }

    [Fact]
    public async Task Duplicate_slug_is_a_conflict_even_when_the_original_is_soft_deleted()
    {
        var first = await _handler.HandleAsync(new CreateTenantCommand("acme-air", "Acme", Spec()));
        _repo.Tenants.Single(t => t.Id == first.Value.TenantId).MarkDeleted(T0);

        var again = await _handler.HandleAsync(new CreateTenantCommand("acme-air", "Acme 2", Spec()));

        Assert.True(again.IsFailure);
        Assert.Equal(ErrorKind.Conflict, again.Error!.Kind);
        Assert.Contains("acme-air", again.Error.Detail, StringComparison.Ordinal);
        Assert.Single(_repo.Tenants);
        Assert.Equal(1, _uow.SaveCount);
    }

    [Fact]
    public async Task Ids_are_time_ordered_so_keyset_paging_on_created_at_id_is_stable()
    {
        var clock = new FixedClock(T0);
        var handler = new CreateTenantHandler(_repo, _outbox, _uow, clock, new FakeUser("a"));

        var a = await handler.HandleAsync(new CreateTenantCommand("tenant-a", "A", Spec()));
        clock.UtcNow = T0.AddMilliseconds(5);
        var b = await handler.HandleAsync(new CreateTenantCommand("tenant-b", "B", Spec()));

        Assert.Equal(7, a.Value.TenantId.Version);
        Assert.True(string.CompareOrdinal(a.Value.TenantId.ToString(), b.Value.TenantId.ToString()) < 0);
    }
}
