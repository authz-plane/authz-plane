using AuthzPlane.Domain.Common;

namespace AuthzPlane.Domain.Reconciliation;

/// <summary>
/// Retry schedule for failed reconcile runs. Section 7.4: 5s, 15s, 45s, 2m, 6m,
/// capped at 15m, with a maximum of 8 attempts before the tenant goes to
/// <c>Failed</c> and requires a human.
/// </summary>
/// <remarks>
/// Deliberately a pure function of (attempt, jitter). Nothing here reads a clock
/// or a random number generator: the caller supplies both. That is what lets the
/// convergence tests assert the whole retry curve in microseconds instead of
/// sleeping through it, and it is why <c>DateTime.UtcNow</c> is banned outside
/// the clock adapter.
/// </remarks>
public static class BackoffPolicy
{
    /// <summary>After this many consecutive failures the tenant is Failed.</summary>
    public const int MaxAttempts = 8;

    /// <summary>Jitter spreads retries by up to +/- this fraction of the delay.</summary>
    public const double JitterFraction = 0.20;

    private static readonly TimeSpan[] Schedule =
    [
        TimeSpan.FromSeconds(5),
        TimeSpan.FromSeconds(15),
        TimeSpan.FromSeconds(45),
        TimeSpan.FromMinutes(2),
        TimeSpan.FromMinutes(6),
    ];

    /// <summary>The cap applied to every attempt beyond the explicit schedule.</summary>
    public static readonly TimeSpan Cap = TimeSpan.FromMinutes(15);

    /// <summary>
    /// Delay before attempt number <paramref name="attempt"/> (1-based).
    /// </summary>
    /// <param name="attempt">1-based consecutive failure count.</param>
    /// <param name="jitter">
    /// Value in [0,1), normally from a PRNG. 0.5 means no jitter; 0 and values
    /// approaching 1 give the extremes of the +/- <see cref="JitterFraction"/> band.
    /// </param>
    public static TimeSpan DelayFor(int attempt, double jitter = 0.5)
    {
        if (attempt < 1)
        {
            throw new DomainException($"Attempt must be 1 or greater; got {attempt}.");
        }

        if (jitter is < 0 or >= 1)
        {
            throw new DomainException($"Jitter must be in [0,1); got {jitter}.");
        }

        var baseDelay = attempt <= Schedule.Length ? Schedule[attempt - 1] : Cap;
        if (baseDelay > Cap)
        {
            baseDelay = Cap;
        }

        // Map jitter [0,1) onto [-JitterFraction, +JitterFraction).
        var multiplier = 1.0 + ((jitter - 0.5) * 2.0 * JitterFraction);
        return TimeSpan.FromTicks((long)(baseDelay.Ticks * multiplier));
    }

    /// <summary>True when the failure count has exhausted the retry budget.</summary>
    public static bool IsExhausted(int consecutiveFailures) =>
        consecutiveFailures >= MaxAttempts;
}
