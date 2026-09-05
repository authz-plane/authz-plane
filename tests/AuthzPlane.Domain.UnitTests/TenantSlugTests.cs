using AuthzPlane.Domain.Common;
using AuthzPlane.Domain.Tenants;
using Xunit;

namespace AuthzPlane.Domain.UnitTests;

public sealed class TenantSlugTests
{
    [Theory]
    [InlineData("acme")]
    [InlineData("acme-corp")]
    [InlineData("a1b")]
    [InlineData("tenant-with-many-hyphens-1")]
    public void Accepts_valid_slugs(string value) =>
        Assert.Equal(value, TenantSlug.Create(value).Value);

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    [InlineData("ab")]                  // too short
    [InlineData("-acme")]               // leading hyphen
    [InlineData("acme-")]               // trailing hyphen
    [InlineData("Acme")]                // uppercase
    [InlineData("acme_corp")]           // underscore
    [InlineData("acme corp")]           // space
    [InlineData("acme.corp")]           // dot
    public void Rejects_invalid_slugs(string? value) =>
        Assert.Throws<DomainException>(() => TenantSlug.Create(value));

    [Fact]
    public void Rejects_slugs_over_the_dns_label_limit() =>
        Assert.Throws<DomainException>(() => TenantSlug.Create(new string('a', 64)));

    [Fact]
    public void Accepts_a_slug_at_exactly_the_limit() =>
        Assert.Equal(63, TenantSlug.Create(new string('a', 63)).Value.Length);

    [Fact]
    public void TryCreate_reports_failure_without_throwing()
    {
        Assert.False(TenantSlug.TryCreate("BAD", out _));
        Assert.True(TenantSlug.TryCreate("good", out var slug));
        Assert.Equal("good", slug.Value);
    }

    [Fact]
    public void Equality_is_by_value()
    {
        Assert.Equal(TenantSlug.Create("acme"), TenantSlug.Create("acme"));
        Assert.NotEqual(TenantSlug.Create("acme"), TenantSlug.Create("other"));
    }
}
