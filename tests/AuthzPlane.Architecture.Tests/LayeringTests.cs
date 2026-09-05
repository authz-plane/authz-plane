using System.Reflection;
using AuthzPlane.Domain.Common;
using NetArchTest.Rules;
using Xunit;

namespace AuthzPlane.Architecture.Tests;

/// <summary>
/// The dependency rule from section 6, enforced by test rather than by
/// discipline. A reference added in the wrong direction is a red build.
/// </summary>
public sealed class LayeringTests
{
    private static readonly Assembly Domain = typeof(Entity).Assembly;
    private static readonly Assembly Application = typeof(Application.Abstractions.IClock).Assembly;
    private static readonly Assembly Infrastructure = typeof(Infrastructure.DependencyInjection).Assembly;

    [Fact]
    public void Domain_depends_on_nothing_of_ours_and_no_persistence()
    {
        var result = Types.InAssembly(Domain)
            .ShouldNot()
            .HaveDependencyOnAny(
                "AuthzPlane.Application",
                "AuthzPlane.Infrastructure",
                "AuthzPlane.Api",
                "Microsoft.EntityFrameworkCore",
                "Npgsql")
            .GetResult();

        Assert.True(result.IsSuccessful, Describe(result));
    }

    [Fact]
    public void Application_depends_only_on_Domain()
    {
        var result = Types.InAssembly(Application)
            .ShouldNot()
            .HaveDependencyOnAny(
                "AuthzPlane.Infrastructure",
                "AuthzPlane.Api",
                "Microsoft.EntityFrameworkCore",
                "Npgsql")
            .GetResult();

        Assert.True(result.IsSuccessful, Describe(result));
    }

    [Fact]
    public void Infrastructure_does_not_depend_on_the_host()
    {
        var result = Types.InAssembly(Infrastructure)
            .ShouldNot()
            .HaveDependencyOn("AuthzPlane.Api")
            .GetResult();

        Assert.True(result.IsSuccessful, Describe(result));
    }

    private static string Describe(TestResult result) =>
        result.IsSuccessful
            ? "ok"
            : "Offending types: " + string.Join(", ", result.FailingTypeNames ?? []);
}
