using System.Text.Json;
using AuthzPlane.Domain.Common;

namespace AuthzPlane.Domain.Outbox;

/// <summary>
/// Transactional outbox row. Written in the same transaction as the state change
/// it announces, so "spec saved but reconcile never triggered" cannot happen.
/// </summary>
/// <remarks>
/// Lifecycle: created -> claimed (a worker took it with
/// <c>FOR UPDATE SKIP LOCKED</c>) -> processed, or released back with a failure
/// count so another tick can retry. Processed rows are kept, not deleted: they
/// are cheap and they answer "did the reconcile for generation 9 ever fire".
/// </remarks>
public sealed class OutboxMessage : Entity, ITenantScoped
{
    /// <summary>After this many failures the message stays unclaimed for a human to look at.</summary>
    public const int MaxAttempts = 8;

    private OutboxMessage()
    {
    }

    private OutboxMessage(Guid id, Guid tenantId, string type, string payload, DateTimeOffset createdAt)
        : base(id)
    {
        TenantId = tenantId;
        Type = type;
        Payload = payload;
        CreatedAt = createdAt;
    }

    public Guid TenantId { get; private set; }

    /// <summary>One of <see cref="OutboxMessageTypes"/>.</summary>
    public string Type { get; private set; } = string.Empty;

    /// <summary>Message body, stored as jsonb.</summary>
    public string Payload { get; private set; } = "{}";

    public int Attempts { get; private set; }

    public string? LastError { get; private set; }

    public DateTimeOffset? LastFailedAt { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    /// <summary>Set while a worker holds the message. Null when available.</summary>
    public DateTimeOffset? ClaimedAt { get; private set; }

    public DateTimeOffset? ProcessedAt { get; private set; }

    public bool IsProcessed => ProcessedAt is not null;

    public bool IsClaimed => ClaimedAt is not null && !IsProcessed;

    /// <summary>Retry budget exhausted; the worker must not pick this up again.</summary>
    public bool IsDead => !IsProcessed && Attempts >= MaxAttempts;

    public static OutboxMessage Create(
        Guid id, Guid tenantId, string type, JsonElement payload, DateTimeOffset createdAt)
    {
        if (tenantId == Guid.Empty)
        {
            throw new DomainException("Outbox message requires a tenant id.");
        }

        if (!OutboxMessageTypes.All.Contains(type))
        {
            throw new DomainException($"Unknown outbox message type '{type}'.");
        }

        if (payload.ValueKind is not JsonValueKind.Object)
        {
            throw new DomainException("Outbox payload must be a JSON object.");
        }

        return new OutboxMessage(id, tenantId, type, payload.GetRawText(), createdAt);
    }

    /// <summary>A worker takes ownership. The row lock is the real guard; this is the model's view of it.</summary>
    public void Claim(DateTimeOffset now)
    {
        if (IsProcessed)
        {
            throw new DomainException($"Outbox message {Id} is already processed.");
        }

        if (IsClaimed)
        {
            throw new DomainException($"Outbox message {Id} is already claimed.");
        }

        if (IsDead)
        {
            throw new DomainException(
                $"Outbox message {Id} has failed {Attempts} times and needs a human.");
        }

        ClaimedAt = now;
    }

    public void MarkProcessed(DateTimeOffset now)
    {
        EnsureClaimed();
        ProcessedAt = now;
        LastError = null;
    }

    /// <summary>Releases the claim so the next tick can retry, and counts the failure.</summary>
    public void RecordFailure(string error, DateTimeOffset now)
    {
        EnsureClaimed();

        if (string.IsNullOrWhiteSpace(error))
        {
            throw new DomainException("A failure needs an error message.");
        }

        Attempts++;
        LastError = error.Length > 4000 ? error[..4000] : error;
        LastFailedAt = now;
        ClaimedAt = null;
    }

    private void EnsureClaimed()
    {
        if (!IsClaimed)
        {
            throw new DomainException($"Outbox message {Id} is not claimed.");
        }
    }
}
