using AuthzPlane.Domain.Audit;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuthzPlane.Infrastructure.Persistence.Configurations;

internal sealed class AuditEventConfiguration : IEntityTypeConfiguration<AuditEvent>
{
    public void Configure(EntityTypeBuilder<AuditEvent> builder)
    {
        builder.ToTable("audit_events");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Actor).HasMaxLength(320).IsRequired();
        builder.Property(e => e.Action).HasMaxLength(100).IsRequired();
        builder.Property(e => e.ResourceType).HasMaxLength(100).IsRequired();
        builder.Property(e => e.ResourceId).HasMaxLength(512).IsRequired();
        builder.Property(e => e.Before).HasColumnType("jsonb");
        builder.Property(e => e.After).HasColumnType("jsonb");
        builder.Property(e => e.RequestId).HasMaxLength(64);
        builder.Property(e => e.TraceId).HasMaxLength(64);

        // Section 8.4: tenant first, newest first. This is the audit screen's query.
        builder.HasIndex(e => new { e.TenantId, e.OccurredAt })
            .IsDescending(false, true)
            .HasDatabaseName("ix_audit_tenant_time");

        // Deliberately no foreign key to tenants. Audit history must outlive
        // anything that could ever hard-delete a tenant row, and the API's
        // database role has no UPDATE or DELETE grant on this table.
    }
}
