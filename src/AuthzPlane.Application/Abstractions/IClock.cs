namespace AuthzPlane.Application.Abstractions;

/// <summary>
/// The only sanctioned source of wall-clock time.
/// </summary>
/// <remarks>
/// Backoff schedules, convergence windows and drift resync intervals are all
/// time-dependent. If any of them read <c>DateTime.UtcNow</c> directly, the only
/// way to test them is to sleep, and the suite becomes slow and flaky. An
/// architecture test enforces that nothing outside the clock adapter touches
/// ambient time.
/// </remarks>
public interface IClock
{
    DateTimeOffset UtcNow { get; }
}
