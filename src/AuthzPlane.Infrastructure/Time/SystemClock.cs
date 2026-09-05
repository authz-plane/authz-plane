using AuthzPlane.Application.Abstractions;

namespace AuthzPlane.Infrastructure.Time;

/// <summary>
/// The single sanctioned reader of ambient time in the whole solution.
/// </summary>
/// <remarks>
/// <c>NoAmbientTimeTests</c> allows this file and no other. Built on
/// <see cref="TimeProvider"/> so tests can substitute a fake without needing a
/// separate clock abstraction of their own.
/// </remarks>
public sealed class SystemClock(TimeProvider timeProvider) : IClock
{
    public DateTimeOffset UtcNow => timeProvider.GetUtcNow();
}
