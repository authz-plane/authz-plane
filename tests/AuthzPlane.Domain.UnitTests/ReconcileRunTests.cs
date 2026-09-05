using AuthzPlane.Domain.Common;
using AuthzPlane.Domain.Reconciliation;
using AuthzPlane.Domain.Tenants;
using Xunit;

namespace AuthzPlane.Domain.UnitTests;

public sealed class ChangeKeyTests
{
    private static readonly Guid Tenant = Guid.Parse("11111111-1111-1111-1111-111111111111");

    [Fact]
    public void Is_deterministic_for_the_same_inputs() =>
        Assert.Equal(
            ChangeKey.Of(Tenant, ResourceKind.Organization, "org:acme", "h1"),
            ChangeKey.Of(Tenant, ResourceKind.Organization, "org:acme", "h1"));

    [Fact]
    public void Differs_when_the_target_state_differs() =>
        // This is what makes a spec change produce a new change rather than
        // silently matching the already-applied key.
        Assert.NotEqual(
            ChangeKey.Of(Tenant, ResourceKind.Organization, "org:acme", "h1"),
            ChangeKey.Of(Tenant, ResourceKind.Organization, "org:acme", "h2"));

    [Fact]
    public void Differs_across_tenants() =>
        Assert.NotEqual(
            ChangeKey.Of(Tenant, ResourceKind.Organization, "org:acme", "h1"),
            ChangeKey.Of(Guid.NewGuid(), ResourceKind.Organization, "org:acme", "h1"));

    [Fact]
    public void Differs_across_resource_kinds() =>
        Assert.NotEqual(
            ChangeKey.Of(Tenant, ResourceKind.Organization, "x", "h"),
            ChangeKey.Of(Tenant, ResourceKind.User, "x", "h"));

    [Fact]
    public void Delimiter_prevents_component_boundary_collisions() =>
        // Without a delimiter, ("ab","c") and ("a","bc") would concatenate
        // identically and two unrelated changes would share an idempotency key.
        Assert.NotEqual(
            ChangeKey.Of(Tenant, ResourceKind.Organization, "ab", "c"),
            ChangeKey.Of(Tenant, ResourceKind.Organization, "a", "bc"));

    [Theory]
    [InlineData("", "h")]
    [InlineData("  ", "h")]
    [InlineData("ref", "")]
    public void Rejects_missing_components(string resourceRef, string hash) =>
        Assert.Throws<DomainException>(
            () => ChangeKey.Of(Tenant, ResourceKind.User, resourceRef, hash));
}

public sealed class ReconcileRunTests
{
    private static readonly DateTimeOffset T0 = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

    private static ReconcileRun NewRun() => ReconcileRun.Start(
        Guid.NewGuid(), Guid.NewGuid(), Generation.First, ReconcileTrigger.SpecChanged, T0);

    private static ReconcileChange NewChange(ReconcileRun run, string resourceRef, int ordinal = 0) =>
        ReconcileChange.Create(
            Guid.NewGuid(), run.Id,
            ChangeKey.Of(run.TenantId, ResourceKind.User, resourceRef, "target"),
            ResourceKind.User, resourceRef, ChangeOperation.Create, ordinal);

    [Fact]
    public void Empty_plan_finishes_as_NoOp() =>
        // The no-op invariant, at the run level.
        Assert.Equal(RunOutcome.NoOp, NewRun().Finish(T0));

    [Fact]
    public void All_changes_applied_finishes_as_Succeeded()
    {
        var run = NewRun();
        var a = NewChange(run, "user:a");
        var b = NewChange(run, "user:b", 1);
        run.AddChange(a);
        run.AddChange(b);
        a.MarkApplied(10);
        b.MarkAlreadyApplied(1);

        Assert.Equal(RunOutcome.Succeeded, run.Finish(T0));
    }

    [Fact]
    public void Mixed_results_finish_as_PartiallyApplied()
    {
        var run = NewRun();
        var a = NewChange(run, "user:a");
        var b = NewChange(run, "user:b", 1);
        run.AddChange(a);
        run.AddChange(b);
        a.MarkApplied(10);
        b.MarkFailed("409 conflict", 5);

        Assert.Equal(RunOutcome.PartiallyApplied, run.Finish(T0));
    }

    [Fact]
    public void All_changes_failed_finishes_as_Failed()
    {
        var run = NewRun();
        var a = NewChange(run, "user:a");
        run.AddChange(a);
        a.MarkFailed("boom", 5);

        Assert.Equal(RunOutcome.Failed, run.Finish(T0));
    }

    [Fact]
    public void Duplicate_change_keys_are_rejected()
    {
        var run = NewRun();
        run.AddChange(NewChange(run, "user:a"));
        Assert.Throws<DomainException>(() => run.AddChange(NewChange(run, "user:a", 1)));
    }

    [Fact]
    public void A_change_from_another_run_is_rejected()
    {
        var run = NewRun();
        var other = NewRun();
        Assert.Throws<DomainException>(() => run.AddChange(NewChange(other, "user:a")));
    }

    [Fact]
    public void A_finished_run_cannot_be_finished_again()
    {
        var run = NewRun();
        run.Finish(T0);
        Assert.Throws<DomainException>(() => run.Finish(T0));
    }

    [Fact]
    public void A_run_that_applied_changes_cannot_be_marked_Skipped()
    {
        var run = NewRun();
        run.AddChange(NewChange(run, "user:a"));
        Assert.Throws<DomainException>(() => run.Skip(T0));
    }

    [Fact]
    public void A_change_cannot_be_settled_twice()
    {
        var run = NewRun();
        var a = NewChange(run, "user:a");
        run.AddChange(a);
        a.MarkApplied(1);
        Assert.Throws<DomainException>(() => a.MarkFailed("late", 1));
    }
}
