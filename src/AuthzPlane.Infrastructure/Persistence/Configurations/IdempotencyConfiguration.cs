using AuthzPlane.Infrastructure.Idempotency;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuthzPlane.Infrastructure.Persistence.Configurations;

internal sealed class IdempotencyRecordConfiguration : IEntityTypeConfiguration<IdempotencyRecord>
{
    public void Configure(EntityTypeBuilder<IdempotencyRecord> builder)
    {
        builder.ToTable("idempotency_keys");

        // Per-actor keys: one caller's key can never replay another caller's response.
        builder.HasKey(r => new { r.Actor, r.Key });

        builder.Property(r => r.Actor).HasMaxLength(320).IsRequired();
        builder.Property(r => r.Key).HasMaxLength(IdempotencyRecord.KeyMaxLength).IsRequired();
        builder.Property(r => r.RequestHash).HasMaxLength(64).IsRequired();
        builder.Property(r => r.ContentType).HasMaxLength(100);

        // text, not jsonb: a replay must return the original bytes, and jsonb
        // normalises whitespace and key order on the way in.
        builder.Property(r => r.ResponseBody).HasColumnType("text");

        // For the periodic purge of expired keys.
        builder.HasIndex(r => r.ExpiresAt).HasDatabaseName("ix_idempotency_expires");
    }
}
