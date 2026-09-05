using System.Text.Json;
using AuthzPlane.Domain.Common;
using AuthzPlane.Domain.Outbox;

namespace AuthzPlane.Domain.UnitTests;

public sealed class OutboxMessageTests
{
    private static readonly DateTimeOffset T0 = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

    private static JsonElement Payload(string json = """{"generation":1}""") =>
        JsonDocument.Parse(json).RootElement.Clone();

    private static OutboxMessage NewMessage() =>
        OutboxMessage.Create(Guid.NewGuid(), Guid.NewGuid(), OutboxMessageTypes.TenantSpecWritten, Payload(), T0);

    [Fact]
    public void New_message_is_unclaimed_and_unprocessed()
    {
        var m = NewMessage();

        Assert.False(m.IsClaimed);
        Assert.False(m.IsProcessed);
        Assert.False(m.IsDead);
        Assert.Equal(0, m.Attempts);
        Assert.Equal("""{"generation":1}""", m.Payload);
        Assert.Equal(T0, m.CreatedAt);
    }

    [Fact]
    public void Rejects_unknown_type_empty_tenant_and_non_object_payload()
    {
        Assert.Throws<DomainException>(() =>
            OutboxMessage.Create(Guid.NewGuid(), Guid.NewGuid(), "tenant.exploded", Payload(), T0));
        Assert.Throws<DomainException>(() =>
            OutboxMessage.Create(Guid.NewGuid(), Guid.Empty, OutboxMessageTypes.TenantSpecWritten, Payload(), T0));
        Assert.Throws<DomainException>(() =>
            OutboxMessage.Create(Guid.NewGuid(), Guid.NewGuid(), OutboxMessageTypes.TenantSpecWritten, Payload("[1]"), T0));
    }

    [Fact]
    public void Claim_then_process_is_the_happy_path()
    {
        var m = NewMessage();
        m.Claim(T0);
        Assert.True(m.IsClaimed);
        Assert.Equal(T0, m.ClaimedAt);

        m.MarkProcessed(T0.AddSeconds(2));
        Assert.True(m.IsProcessed);
        Assert.False(m.IsClaimed);
        Assert.Equal(T0.AddSeconds(2), m.ProcessedAt);
    }

    [Fact]
    public void Cannot_claim_twice_or_claim_a_processed_message()
    {
        var m = NewMessage();
        m.Claim(T0);
        Assert.Throws<DomainException>(() => m.Claim(T0));

        m.MarkProcessed(T0);
        Assert.Throws<DomainException>(() => m.Claim(T0));
    }

    [Fact]
    public void Processing_or_failing_requires_a_claim()
    {
        var m = NewMessage();
        Assert.Throws<DomainException>(() => m.MarkProcessed(T0));
        Assert.Throws<DomainException>(() => m.RecordFailure("boom", T0));
    }

    [Fact]
    public void Failure_releases_the_claim_and_counts_the_attempt()
    {
        var m = NewMessage();
        m.Claim(T0);
        m.RecordFailure("openfga timeout", T0);

        Assert.False(m.IsClaimed);
        Assert.Equal(1, m.Attempts);
        Assert.Equal("openfga timeout", m.LastError);

        // Available again for the next tick.
        m.Claim(T0.AddSeconds(5));
        Assert.True(m.IsClaimed);
    }

    [Fact]
    public void Success_after_failures_clears_the_error()
    {
        var m = NewMessage();
        m.Claim(T0);
        m.RecordFailure("first", T0);
        m.Claim(T0);
        m.MarkProcessed(T0);

        Assert.Null(m.LastError);
        Assert.Equal(1, m.Attempts);
    }

    [Fact]
    public void Exhausting_the_budget_makes_the_message_dead_and_unclaimable()
    {
        var m = NewMessage();
        for (var i = 0; i < OutboxMessage.MaxAttempts; i++)
        {
            m.Claim(T0);
            m.RecordFailure($"failure {i}", T0);
        }

        Assert.True(m.IsDead);
        Assert.Throws<DomainException>(() => m.Claim(T0));
    }

    [Fact]
    public void Failure_message_is_truncated_to_the_column_width()
    {
        var m = NewMessage();
        m.Claim(T0);
        m.RecordFailure(new string('x', 5000), T0);
        Assert.Equal(4000, m.LastError!.Length);
    }
}
