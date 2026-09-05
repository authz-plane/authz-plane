using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using AuthzPlane.Domain.Common;

namespace AuthzPlane.Domain.Tenants;

/// <summary>
/// SHA-256 over a <em>canonical</em> rendering of a tenant spec.
/// </summary>
/// <remarks>
/// The canonicalisation is load-bearing, not cosmetic. The no-op invariant
/// (<c>Plan(d, d) == []</c>) is what stops the reconciler flapping and retry
/// storms. If two semantically identical specs hashed differently - because one
/// was pretty-printed, or because a client serialised keys in a different order
/// - every reconcile would see a spurious change and the invariant would fail
/// silently. So we sort object keys and strip insignificant whitespace before
/// hashing.
///
/// Known limitation: JSON number formats are preserved verbatim
/// (<c>1</c> and <c>1.0</c> hash differently). Normalising those needs a
/// decision about precision that belongs in an ADR, not in a hash function.
/// The API layer should reject or normalise on write instead.
/// </remarks>
public readonly record struct SpecHash
{
    private const int HexLength = 64;

    public string Value { get; }

    private SpecHash(string value) => Value = value;

    public static SpecHash Parse(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length != HexLength)
        {
            throw new DomainException(
                $"Spec hash must be {HexLength} hex characters; got '{value}'.");
        }

        foreach (var c in value)
        {
            if (!char.IsAsciiDigit(c) && c is < 'a' or > 'f')
            {
                throw new DomainException($"Spec hash must be lowercase hex; got '{value}'.");
            }
        }

        return new SpecHash(value);
    }

    /// <summary>Hashes a spec document, canonicalising it first.</summary>
    public static SpecHash Of(JsonElement spec)
    {
        var canonical = Canonicalise(spec);
        var digest = SHA256.HashData(Encoding.UTF8.GetBytes(canonical));
        return new SpecHash(Convert.ToHexStringLower(digest));
    }

    /// <summary>Hashes a spec supplied as raw JSON text.</summary>
    public static SpecHash Of(string specJson)
    {
        using var doc = JsonDocument.Parse(specJson);
        return Of(doc.RootElement);
    }

    /// <summary>
    /// Object keys sorted by ordinal, no insignificant whitespace, array order
    /// preserved (array order is semantically meaningful in a spec).
    /// </summary>
    public static string Canonicalise(JsonElement element)
    {
        var buffer = new MemoryStream();
        using (var writer = new Utf8JsonWriter(buffer, new JsonWriterOptions { Indented = false }))
        {
            Write(element, writer);
        }

        return Encoding.UTF8.GetString(buffer.ToArray());
    }

    private static void Write(JsonElement element, Utf8JsonWriter writer)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                writer.WriteStartObject();
                foreach (var prop in element.EnumerateObject()
                             .OrderBy(p => p.Name, StringComparer.Ordinal))
                {
                    writer.WritePropertyName(prop.Name);
                    Write(prop.Value, writer);
                }

                writer.WriteEndObject();
                break;

            case JsonValueKind.Array:
                writer.WriteStartArray();
                foreach (var item in element.EnumerateArray())
                {
                    Write(item, writer);
                }

                writer.WriteEndArray();
                break;

            default:
                // Scalars keep their raw text; see the number caveat above.
                writer.WriteRawValue(element.GetRawText(), skipInputValidation: true);
                break;
        }
    }

    public override string ToString() => Value;
}
