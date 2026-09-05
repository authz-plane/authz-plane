using System.Text.Json;
using AuthzPlane.Domain.Common;
using AuthzPlane.Domain.Tenants;
using Xunit;

namespace AuthzPlane.Domain.UnitTests;

/// <summary>
/// These protect the no-op invariant. If canonicalisation regresses, the
/// reconciler starts seeing phantom changes on every pass and retry storms.
/// </summary>
public sealed class SpecHashTests
{
    private static JsonElement Json(string raw) => JsonDocument.Parse(raw).RootElement.Clone();

    [Fact]
    public void Identical_specs_hash_identically() =>
        Assert.Equal(
            SpecHash.Of(Json("""{"a":1,"b":2}""")),
            SpecHash.Of(Json("""{"a":1,"b":2}""")));

    [Fact]
    public void Key_order_does_not_change_the_hash() =>
        Assert.Equal(
            SpecHash.Of(Json("""{"a":1,"b":2}""")),
            SpecHash.Of(Json("""{"b":2,"a":1}""")));

    [Fact]
    public void Insignificant_whitespace_does_not_change_the_hash() =>
        Assert.Equal(
            SpecHash.Of(Json("""{"a":1,"b":2}""")),
            SpecHash.Of(Json("{\n  \"a\" : 1,\n  \"b\" : 2\n}")));

    [Fact]
    public void Nested_key_order_does_not_change_the_hash() =>
        Assert.Equal(
            SpecHash.Of(Json("""{"outer":{"x":1,"y":2}}""")),
            SpecHash.Of(Json("""{"outer":{"y":2,"x":1}}""")));

    [Fact]
    public void Array_order_DOES_change_the_hash() =>
        // Array order is semantically meaningful in a spec, so it is preserved.
        Assert.NotEqual(
            SpecHash.Of(Json("""{"roles":["admin","viewer"]}""")),
            SpecHash.Of(Json("""{"roles":["viewer","admin"]}""")));

    [Fact]
    public void Different_values_hash_differently() =>
        Assert.NotEqual(
            SpecHash.Of(Json("""{"a":1}""")),
            SpecHash.Of(Json("""{"a":2}""")));

    [Fact]
    public void Hash_is_64_lowercase_hex_characters()
    {
        var value = SpecHash.Of(Json("""{"a":1}""")).Value;
        Assert.Equal(64, value.Length);
        Assert.All(value, c => Assert.True(char.IsAsciiDigit(c) || c is >= 'a' and <= 'f'));
    }

    [Fact]
    public void Parse_rejects_malformed_hashes()
    {
        Assert.Throws<DomainException>(() => SpecHash.Parse("tooshort"));
        Assert.Throws<DomainException>(() => SpecHash.Parse(new string('A', 64)));  // uppercase
        Assert.Throws<DomainException>(() => SpecHash.Parse(new string('z', 64)));  // not hex
    }

    [Fact]
    public void Canonicalise_sorts_keys_and_strips_whitespace() =>
        Assert.Equal("""{"a":1,"b":2}""", SpecHash.Canonicalise(Json("""{ "b" : 2, "a" : 1 }""")));
}
