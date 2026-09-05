using System.Text.RegularExpressions;
using AuthzPlane.Domain.Common;

namespace AuthzPlane.Domain.Tenants;

/// <summary>
/// A tenant's stable, URL-safe identifier. Chosen at creation and immutable
/// thereafter, because it appears in external system names that we do not
/// control and cannot cheaply rename.
/// </summary>
public readonly partial record struct TenantSlug
{
    public const int MinLength = 3;
    public const int MaxLength = 63;

    public string Value { get; }

    private TenantSlug(string value) => Value = value;

    /// <summary>DNS-label shape: it ends up in hostnames and external org names.</summary>
    [GeneratedRegex("^[a-z0-9]([a-z0-9-]*[a-z0-9])?$")]
    private static partial Regex SlugPattern();

    public static TenantSlug Create(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new DomainException("Tenant slug is required.");
        }

        if (value.Length is < MinLength or > MaxLength)
        {
            throw new DomainException(
                $"Tenant slug must be {MinLength}-{MaxLength} characters; got {value.Length}.");
        }

        if (!SlugPattern().IsMatch(value))
        {
            throw new DomainException(
                $"Tenant slug '{value}' must be lowercase alphanumeric or hyphen, " +
                "and may not start or end with a hyphen.");
        }

        return new TenantSlug(value);
    }

    public static bool TryCreate(string? value, out TenantSlug slug)
    {
        try
        {
            slug = Create(value);
            return true;
        }
        catch (DomainException)
        {
            slug = default;
            return false;
        }
    }

    public override string ToString() => Value;
}
