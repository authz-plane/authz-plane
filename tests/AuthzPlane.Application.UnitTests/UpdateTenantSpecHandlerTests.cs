using System.Text.Json;
using AuthzPlane.Application.Common;
using AuthzPlane.Application.Tenants.Commands;
using AuthzPlane.Domain.Outbox;
using AuthzPlane.Domain.Tenants;

namespace AuthzPlane.Application.UnitTests;

public sealed class UpdateTenantSpecHandlerTests
{
    private static readonly DateTimeOffset T0 = new(2026, 9, 4, 10, 15, 0, TimeSpan.Zero);

    private readonly InMemoryTenantRepository _repo = new();
    private readonly FakeOutbox _outbox = new();
    private readonly FakeUnitOfWork _uow = new();
    private readonly RecordingScopeSetter _scope = new();
    private readonly FixedClock _clock = new(T0);
    private readonly UpdateTenantSpecHandler _handler;
    private readonly Guid _tenantId;

    public UpdateTenantSpecHandlerTests()
    {
        // Seed one tenant at generation 1 through the real create handler.
        var create = new CreateTenantHandler(_repo, _outbox, _uow, _clock, new FakeUser("seed"));
        _tenantId = create.HandleAsync(new CreateTenantCommand("acme-air", "Acme", Spec("""{"v":1}"""))).Result.Value.TenantId;
        _outbox.Messages.Clear();

        _handler = new UpdateTenantSpecHandler(_repo, _outbox, _uow, _clock, new FakeUser("ops@example.test"), _scope);
    }

    private static JsonElement Spec(string json) => JsonDocument.Parse(json).RootElement.Clone();

    [Fact]
    public async Task Happy_path_appends_a_version_bumps_generation_and_enqueues_once()
    {
        _clock.UtcNow = T0.AddMinutes(1);

        var result = await _handler.HandleAsync(new UpdateTenantSpecCommand(_tenantId, 1, Spec("""{"v":2}""")));

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.Changed);
        Assert.Equal(2, result.Value.Generation);

        Assert.Equal(Generation.From(2), _repo.Tenants.Single().Generation);
        Assert.Equal(2, _repo.Specs.Count);
        var latest = _repo.Specs.Single(s => s.Generation == Generation.From(2));
        Assert.Equal("ops@example.test", latest.CreatedBy);
        Assert.Equal(T0.AddMinutes(1), latest.CreatedAt);
        Assert.Equal(result.Value.SpecHash, latest.SpecHash.Value);

        var message = Assert.Single(_outbox.Messages);
        Assert.Equal(OutboxMessageTypes.TenantSpecWritten, message.Type);
        Assert.Contains("\"generation\":2", message.Payload, StringComparison.Ordinal);

        Assert.Equal(2, _uow.SaveCount); // one for the seed, one for this write
    }

    [Fact]
    public async Task Missing_If_Match_is_precondition_required_and_writes_nothing()
    {
        var result = await _handler.HandleAsync(new UpdateTenantSpecCommand(_tenantId, null, Spec("""{"v":2}""")));

        Assert.Equal(ErrorKind.PreconditionRequired, result.Error!.Kind);
        Assert.Single(_repo.Specs);
        Assert.Empty(_outbox.Messages);
    }

    [Fact]
    public async Task Stale_If_Match_is_precondition_failed_and_reports_the_current_generation()
    {
        var result = await _handler.HandleAsync(new UpdateTenantSpecCommand(_tenantId, 7, Spec("""{"v":2}""")));

        Assert.Equal(ErrorKind.PreconditionFailed, result.Error!.Kind);
        Assert.Equal(1L, result.Error.Extensions!["currentGeneration"]);
        Assert.Equal(Generation.First, _repo.Tenants.Single().Generation);
        Assert.Single(_repo.Specs);
        Assert.Empty(_outbox.Messages);
    }

    [Fact]
    public async Task Identical_spec_is_a_no_op_with_no_bump_no_row_and_no_reconcile()
    {
        // Different key order and whitespace; same canonical document.
        var result = await _handler.HandleAsync(new UpdateTenantSpecCommand(_tenantId, 1, Spec("""{ "v" : 1 }""")));

        Assert.True(result.IsSuccess);
        Assert.False(result.Value.Changed);
        Assert.Equal(1, result.Value.Generation);
        Assert.Single(_repo.Specs);
        Assert.Empty(_outbox.Messages);
        Assert.Equal(1, _uow.SaveCount); // only the seed
    }

    [Fact]
    public async Task Unknown_or_deleted_tenant_is_not_found()
    {
        var unknown = await _handler.HandleAsync(new UpdateTenantSpecCommand(Guid.NewGuid(), 1, Spec("{}")));
        Assert.Equal(ErrorKind.NotFound, unknown.Error!.Kind);

        _repo.Tenants.Single().MarkDeleted(T0);
        var deleted = await _handler.HandleAsync(new UpdateTenantSpecCommand(_tenantId, 1, Spec("{}")));
        Assert.Equal(ErrorKind.NotFound, deleted.Error!.Kind);
    }

    [Fact]
    public async Task Non_object_spec_is_rejected_before_any_lookup()
    {
        var result = await _handler.HandleAsync(new UpdateTenantSpecCommand(_tenantId, 1, Spec("\"nope\"")));
        Assert.Equal(ErrorKind.Validation, result.Error!.Kind);
        Assert.Empty(_scope.Entered);
    }

    [Fact]
    public async Task Enters_tenant_scope_for_the_spec_lookup_and_leaves_it_afterwards()
    {
        await _handler.HandleAsync(new UpdateTenantSpecCommand(_tenantId, 1, Spec("""{"v":3}""")));

        Assert.Equal([_tenantId], _scope.Entered);
        Assert.Equal(0, _scope.Open);
    }

    [Fact]
    public async Task Sequential_edits_each_need_the_latest_generation()
    {
        var second = await _handler.HandleAsync(new UpdateTenantSpecCommand(_tenantId, 1, Spec("""{"v":2}""")));
        var staleThird = await _handler.HandleAsync(new UpdateTenantSpecCommand(_tenantId, 1, Spec("""{"v":3}""")));
        var third = await _handler.HandleAsync(new UpdateTenantSpecCommand(_tenantId, second.Value.Generation, Spec("""{"v":3}""")));

        Assert.Equal(ErrorKind.PreconditionFailed, staleThird.Error!.Kind);
        Assert.Equal(3, third.Value.Generation);
        Assert.Equal(3, _repo.Specs.Count);
    }
}
