using System.Reflection;
using AuthzPlane.Application.Abstractions;
using AuthzPlane.Application.Tenants;
using Xunit;

namespace AuthzPlane.Application.UnitTests;

/// <summary>
/// Guards the shape of the ports. Day 1 has no use cases yet, but the ports are
/// the contract Infrastructure implements, and silently dropping one should not
/// be a quiet compile-time cascade.
/// </summary>
public sealed class PortContractTests
{
    private static readonly Assembly Application = typeof(IClock).Assembly;

    [Theory]
    [InlineData(typeof(IClock))]
    [InlineData(typeof(ICurrentTenant))]
    [InlineData(typeof(ICurrentUser))]
    [InlineData(typeof(IUnitOfWork))]
    [InlineData(typeof(ITenantRepository))]
    public void Port_is_a_public_interface(Type port)
    {
        Assert.True(port.IsInterface, $"{port.Name} must be an interface.");
        Assert.True(port.IsPublic, $"{port.Name} must be public.");
    }

    [Fact]
    public void Every_port_lives_in_the_Application_assembly()
    {
        // Ports defined anywhere else means Infrastructure is dictating the
        // contract, which inverts the dependency rule.
        Type[] ports =
        [
            typeof(IClock), typeof(ICurrentTenant), typeof(ICurrentUser),
            typeof(IUnitOfWork), typeof(ITenantRepository),
        ];

        Assert.All(ports, p => Assert.Equal(Application, p.Assembly));
    }

    [Fact]
    public void Clock_exposes_only_UtcNow()
    {
        // A local-time member would let a caller reintroduce ambient time.
        var members = typeof(IClock).GetMembers().Select(m => m.Name).ToArray();
        Assert.Contains("get_UtcNow", members);
        Assert.DoesNotContain(members, m => m.Contains("Local", StringComparison.Ordinal));
    }
}
