using System.Security.Cryptography;
using System.Text;
using AuthzPlane.Domain.Common;

namespace AuthzPlane.Domain.Reconciliation;

/// <summary>
/// Deterministic identity of an intended mutation:
/// <c>hash(tenantId, resourceKind, resourceRef, targetStateHash)</c>.
/// </summary>
/// <remarks>
/// This is the whole idempotency story. <c>external_resource_map</c> maps a
/// change key to the external id it produced, so replaying a key that has been
/// seen becomes a no-op read rather than a duplicate create. Teardown and retry
/// both depend on it, since either can partially fail and run again.
///
/// Components are joined with ASCII unit separator (U+001F), which cannot appear
/// in a resource ref, so ("ab","c") and ("a","bc") cannot collide.
/// </remarks>
public readonly record struct ChangeKey
{
    private const string Delimiter = "\u001F";

    public string Value { get; }

    private ChangeKey(string value) => Value = value;

    public static ChangeKey Parse(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? throw new DomainException("Change key is required.")
            : new ChangeKey(value);

    public static ChangeKey Of(
        Guid tenantId, ResourceKind kind, string resourceRef, string targetStateHash)
    {
        if (string.IsNullOrWhiteSpace(resourceRef))
        {
            throw new DomainException("Change key requires a resource ref.");
        }

        if (string.IsNullOrWhiteSpace(targetStateHash))
        {
            throw new DomainException("Change key requires a target state hash.");
        }

        var material = string.Join(
            Delimiter, tenantId.ToString("N"), ((int)kind).ToString(), resourceRef, targetStateHash);
        var digest = SHA256.HashData(Encoding.UTF8.GetBytes(material));
        return new ChangeKey(Convert.ToHexStringLower(digest));
    }

    public override string ToString() => Value;
}
