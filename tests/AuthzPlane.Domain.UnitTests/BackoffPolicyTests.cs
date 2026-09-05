using AuthzPlane.Domain.Common;
using AuthzPlane.Domain.Reconciliation;
using Xunit;

namespace AuthzPlane.Domain.UnitTests;

public sealed class BackoffPolicyTests
{
    [Theory]
    [InlineData(1, 5)]
    [InlineData(2, 15)]
    [InlineData(3, 45)]
    [InlineData(4, 120)]
    [InlineData(5, 360)]
    public void Follows_the_documented_schedule(int attempt, int expectedSeconds) =>
        Assert.Equal(expectedSeconds, BackoffPolicy.DelayFor(attempt).TotalSeconds, 3);

    [Theory]
    [InlineData(6)]
    [InlineData(7)]
    [InlineData(8)]
    [InlineData(50)]
    public void Caps_at_fifteen_minutes(int attempt) =>
        Assert.Equal(BackoffPolicy.Cap, BackoffPolicy.DelayFor(attempt));

    [Fact]
    public void Delay_is_monotonic_up_to_the_cap()
    {
        var previous = TimeSpan.Zero;
        for (var attempt = 1; attempt <= BackoffPolicy.MaxAttempts; attempt++)
        {
            var delay = BackoffPolicy.DelayFor(attempt);
            Assert.True(delay >= previous, $"attempt {attempt} went backwards");
            previous = delay;
        }
    }

    [Fact]
    public void Jitter_stays_within_the_declared_band()
    {
        var baseline = BackoffPolicy.DelayFor(3);
        var lowest = BackoffPolicy.DelayFor(3, 0.0);
        var highest = BackoffPolicy.DelayFor(3, 0.999);

        Assert.True(lowest < baseline);
        Assert.True(highest > baseline);
        Assert.True(lowest >= baseline * (1 - BackoffPolicy.JitterFraction));
        Assert.True(highest <= baseline * (1 + BackoffPolicy.JitterFraction));
    }

    [Fact]
    public void Jitter_of_half_is_the_unjittered_delay() =>
        Assert.Equal(TimeSpan.FromSeconds(45), BackoffPolicy.DelayFor(3, 0.5));

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Rejects_non_positive_attempts(int attempt) =>
        Assert.Throws<DomainException>(() => BackoffPolicy.DelayFor(attempt));

    [Theory]
    [InlineData(-0.1)]
    [InlineData(1.0)]
    [InlineData(1.5)]
    public void Rejects_jitter_outside_the_unit_interval(double jitter) =>
        Assert.Throws<DomainException>(() => BackoffPolicy.DelayFor(1, jitter));

    [Fact]
    public void Exhaustion_matches_the_documented_attempt_budget()
    {
        Assert.False(BackoffPolicy.IsExhausted(BackoffPolicy.MaxAttempts - 1));
        Assert.True(BackoffPolicy.IsExhausted(BackoffPolicy.MaxAttempts));
    }
}
