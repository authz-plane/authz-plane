using AuthzPlane.Domain.Outbox;
using AuthzPlane.Domain.Tenants;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuthzPlane.Infrastructure.Persistence.Configurations;

internal sealed class OutboxMessageConfiguration : IEntityTypeConfiguration<OutboxMessage>
{
    public void Configure(EntityTypeBuilder<OutboxMessage> builder)
    {
        builder.ToTable("outbox_messages");
        builder.HasKey(m => m.Id);

        builder.Property(m => m.Type).HasMaxLength(100).IsRequired();
        builder.Property(m => m.Payload).HasColumnType("jsonb").IsRequired();
        builder.Property(m => m.LastError).HasMaxLength(4000);
        builder.Property(m => m.Attempts).IsRequired();

        // The worker's only hot query: "oldest unprocessed messages", claimed with
        // FOR UPDATE SKIP LOCKED. Partial so the index stays the size of the
        // backlog, not the size of history.
        builder.HasIndex(m => m.CreatedAt)
            .HasFilter("processed_at IS NULL")
            .HasDatabaseName("ix_outbox_pending");

        builder.HasOne<Tenant>()
            .WithMany()
            .HasForeignKey(m => m.TenantId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
