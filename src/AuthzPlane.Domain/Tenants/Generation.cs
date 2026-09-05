using AuthzPlane.Domain.Common;

namespace AuthzPlane.Domain.Tenants;

/// <summary>
/// Monotonic version counter for a tenant's desired state. Bumped on every spec
/// write. Convergence is defined as <c>observedGeneration == generation</c>, so
/// this type is the backbone of the whole reconciliation model.
/// </summary>
public readonly record struct Generation : IComparable<Generation>
{
    /// <summary>A tenant that has never had a spec written.</summary>
    public static readonly Generation None = new(0);

    /// <summary>The generation of a tenant's first spec.</summary>
    public static readonly Generation First = new(1);

    public long Value { get; }

    private Generation(long value) => Value = value;

    public static Generation From(long value) => value < 0
        ? throw new DomainException($"Generation cannot be negative; got {value}.")
        : new Generation(value);

    public Generation Next() => new(Value + 1);

    public int CompareTo(Generation other) => Value.CompareTo(other.Value);

    public static bool operator <(Generation a, Generation b) => a.Value < b.Value;
    public static bool operator >(Generation a, Generation b) => a.Value > b.Value;
    public static bool operator <=(Generation a, Generation b) => a.Value <= b.Value;
    public static bool operator >=(Generation a, Generation b) => a.Value >= b.Value;

    public override string ToString() => Value.ToString();
}
