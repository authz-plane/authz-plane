using AuthzPlane.Application.Abstractions;

namespace AuthzPlane.Api.Workers;

/// <summary>
/// Polls the outbox and reconciles tenants. Day-1 placeholder: the loop and its
/// cadence exist so the runtime split and the clock discipline are real, but the
/// body lands on day 2 with the outbox.
/// </summary>
internal sealed class ReconcileWorker(
    IClock clock,
    ILogger<ReconcileWorker> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(5);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation(
            "Reconcile worker started at {StartedAt:o}", clock.UtcNow);

        // PeriodicTimer rather than Task.Delay: it does not drift, and it
        // cancels cleanly on shutdown instead of leaving a pending delay.
        using var timer = new PeriodicTimer(PollInterval);

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                // Day 2: claim outbox messages with FOR UPDATE SKIP LOCKED,
                // take pg_advisory_xact_lock per tenant, run the reconcile.
                logger.LogDebug("Reconcile tick at {Tick:o}", clock.UtcNow);
            }
        }
        catch (OperationCanceledException)
        {
            // Normal shutdown.
        }

        logger.LogInformation("Reconcile worker stopped at {StoppedAt:o}", clock.UtcNow);
    }
}
