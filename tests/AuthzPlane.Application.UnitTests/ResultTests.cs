using AuthzPlane.Application.Common;

namespace AuthzPlane.Application.UnitTests;

public sealed class ResultTests
{
    [Fact]
    public void Success_carries_the_value()
    {
        Result<int> r = 42;
        Assert.True(r.IsSuccess);
        Assert.False(r.IsFailure);
        Assert.Equal(42, r.Value);
        Assert.Null(r.Error);
        Assert.Equal("42", r.Match(v => v.ToString(), e => e.Title));
    }

    [Fact]
    public void Failure_carries_the_error_and_refuses_to_yield_a_value()
    {
        Result<int> r = Errors.NotFound("Tenant not found", "nope");
        Assert.True(r.IsFailure);
        Assert.Equal(ErrorKind.NotFound, r.Error!.Kind);
        Assert.Throws<InvalidOperationException>(() => r.Value);
        Assert.Equal("Tenant not found", r.Match(v => v.ToString(), e => e.Title));
    }

    [Fact]
    public void Precondition_failed_can_carry_extension_members()
    {
        var e = Errors.PreconditionFailed("stale", "x", new Dictionary<string, object?> { ["currentGeneration"] = 9L });
        Assert.Equal(9L, e.Extensions!["currentGeneration"]);
    }
}
