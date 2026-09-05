using AuthzPlane.Domain.Common;
using AuthzPlane.Domain.Reconciliation;
using AuthzPlane.Domain.Tenants;
using Xunit;

namespace AuthzPlane.Domain.UnitTests;

public sealed class TenantLifecycleTests
{
    private static readonly DateTimeOffset T0 = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

    private static TenantStatus NewStatus() => TenantStatus.Create(Guid.NewGuid(), T0);

    [Fact]
    public void New_status_starts_Pending_and_unconverged()
    {
        var status = NewStatus();
        Assert.Equal(TenantPhase.Pending, status.Phase);
        Assert.Equal(Generation.None, status.ObservedGeneration);
        Assert.False(status.IsConverged(Generation.First));
    }

    [Fact]
    public void Happy_path_reaches_Ready_and_reports_converged()
    {
        var status = NewStatus();
        status.BeginPlanning(T0);
        status.BeginApplying(T0);
        status.MarkReady(Generation.First, "hash", T0);

        Assert.Equal(TenantPhase.Ready, status.Phase);
        Assert.True(status.IsConverged(Generation.First));
        Assert.False(status.IsConverged(Generation.First.Next()));
    }

    [Fact]
    public void Empty_plan_goes_straight_from_Planning_to_Ready()
    {
        var status = NewStatus();
        status.BeginPlanning(T0);
        status.MarkReady(Generation.First, null, T0);
        Assert.Equal(TenantPhase.Ready, status.Phase);
    }

    [Theory]
    [InlineData(TenantPhase.Pending, TenantPhase.Ready)]
    [InlineData(TenantPhase.Pending, TenantPhase.Applying)]
    [InlineData(TenantPhase.Ready, TenantPhase.Applying)]
    [InlineData(TenantPhase.Planning, TenantPhase.Deleting)]
    public void Illegal_transitions_are_rejected(TenantPhase from, TenantPhase to) =>
        Assert.False(TenantPhaseTransitions.IsLegal(from, to));

    [Fact]
    public void Transitioning_illegally_throws_with_a_useful_message()
    {
        var status = NewStatus();  // Pending
        var ex = Assert.Throws<DomainException>(() => status.BeginApplying(T0));
        Assert.Contains("Pending", ex.Message, StringComparison.Ordinal);
        Assert.Contains("Applying", ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Deleted_is_terminal()
    {
        Assert.True(TenantPhaseTransitions.IsTerminal(TenantPhase.Deleted));
        Assert.Empty(TenantPhaseTransitions.LegalFrom(TenantPhase.Deleted));
    }

    [Fact]
    public void Degrading_records_the_error_and_schedules_a_retry()
    {
        var status = NewStatus();
        status.BeginPlanning(T0);
        status.BeginApplying(T0);
        status.MarkDegraded("zitadel timeout", T0);

        Assert.Equal(TenantPhase.Degraded, status.Phase);
        Assert.Equal(1, status.ConsecutiveFailures);
        Assert.Equal("zitadel timeout", status.LastError);
        Assert.NotNull(status.NextAttemptAt);
        Assert.True(status.NextAttemptAt > T0);
        Assert.False(status.IsRetryDue(T0));
        Assert.True(status.IsRetryDue(T0.AddMinutes(30)));
    }

    [Fact]
    public void Recovering_clears_the_error_and_the_failure_count()
    {
        var status = NewStatus();
        status.BeginPlanning(T0);
        status.BeginApplying(T0);
        status.MarkDegraded("boom", T0);
        status.BeginPlanning(T0);
        status.MarkReady(Generation.First, "hash", T0);

        Assert.Equal(0, status.ConsecutiveFailures);
        Assert.Null(status.LastError);
        Assert.Null(status.NextAttemptAt);
    }

    [Fact]
    public void Failed_requires_the_retry_budget_to_be_exhausted()
    {
        var status = NewStatus();
        status.BeginPlanning(T0);
        status.BeginApplying(T0);
        status.MarkDegraded("boom", T0);

        // Only one failure so far: refusing here is the point.
        Assert.Throws<DomainException>(() => status.MarkFailed(T0));
    }

    [Fact]
    public void Failed_is_reachable_after_the_budget_is_exhausted()
    {
        var status = NewStatus();
        for (var i = 0; i < BackoffPolicy.MaxAttempts; i++)
        {
            status.BeginPlanning(T0);
            status.BeginApplying(T0);
            status.MarkDegraded($"failure {i}", T0);
        }

        Assert.Equal(BackoffPolicy.MaxAttempts, status.ConsecutiveFailures);
        status.MarkFailed(T0);
        Assert.Equal(TenantPhase.Failed, status.Phase);
        Assert.Null(status.NextAttemptAt);
    }

    [Fact]
    public void Failed_can_be_retried_by_a_human_requesting_reconcile()
    {
        Assert.True(TenantPhaseTransitions.IsLegal(TenantPhase.Failed, TenantPhase.Planning));
        Assert.False(TenantPhaseTransitions.IsTerminal(TenantPhase.Failed));
    }
}
