using System.Text.Json;
using AuthzPlane.Domain.Audit;
using AuthzPlane.Domain.Common;

namespace AuthzPlane.Domain.UnitTests;

public sealed class AuditEventTests
{
    private static readonly DateTimeOffset T0 = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
    private static readonly Guid TenantId = Guid.NewGuid();

    private static JsonElement Json(string json) => JsonDocument.Parse(json).RootElement.Clone();

    [Fact]
    public void Records_before_and_after_as_raw_json()
    {
        var e = AuditEvent.Record(
            Guid.NewGuid(), TenantId, " ops@example.test ", AuditActions.SpecUpdated,
            "tenant", "acme-air", Json("""{"generation":8}"""), Json("""{"generation":9}"""), T0,
            requestId: "req_1", traceId: "trace_1");

        Assert.Equal(TenantId, e.TenantId);
        Assert.Equal("ops@example.test", e.Actor);
        Assert.Equal("SpecUpdated", e.Action);
        Assert.Equal("""{"generation":8}""", e.Before);
        Assert.Equal("""{"generation":9}""", e.After);
        Assert.Equal("req_1", e.RequestId);
        Assert.Equal("trace_1", e.TraceId);
        Assert.Equal(T0, e.OccurredAt);
    }

    [Fact]
    public void Creates_have_no_before_and_deletes_have_no_after()
    {
        var created = AuditEvent.Record(
            Guid.NewGuid(), TenantId, "a", AuditActions.TenantCreated, "tenant", "x", null, Json("{}"), T0);
        var deleted = AuditEvent.Record(
            Guid.NewGuid(), TenantId, "a", AuditActions.TenantDeleteRequested, "tenant", "x", Json("{}"), null, T0);

        Assert.Null(created.Before);
        Assert.NotNull(created.After);
        Assert.NotNull(deleted.Before);
        Assert.Null(deleted.After);
    }

    [Fact]
    public void Rejects_an_event_with_neither_before_nor_after()
    {
        Assert.Throws<DomainException>(() =>
            AuditEvent.Record(Guid.NewGuid(), TenantId, "a", AuditActions.SpecUpdated, "tenant", "x", null, null, T0));
    }

    [Theory]
    [InlineData("", "SpecUpdated", "tenant", "x")]
    [InlineData("a", " ", "tenant", "x")]
    [InlineData("a", "SpecUpdated", "", "x")]
    [InlineData("a", "SpecUpdated", "tenant", "")]
    public void Rejects_blank_identity_fields(string actor, string action, string type, string id)
    {
        Assert.Throws<DomainException>(() =>
            AuditEvent.Record(Guid.NewGuid(), TenantId, actor, action, type, id, null, Json("{}"), T0));
    }

    [Fact]
    public void Requires_a_tenant()
    {
        Assert.Throws<DomainException>(() =>
            AuditEvent.Record(Guid.NewGuid(), Guid.Empty, "a", AuditActions.SpecUpdated, "tenant", "x", null, Json("{}"), T0));
    }

    [Fact]
    public void Has_no_public_mutators()
    {
        // The table has no UPDATE grant; the type must not suggest otherwise.
        var mutators = typeof(AuditEvent)
            .GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.DeclaredOnly)
            .Where(m => !m.IsSpecialName && m.ReturnType == typeof(void))
            .Select(m => m.Name)
            .ToList();

        Assert.Empty(mutators);
    }
}
