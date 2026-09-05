using AuthzPlane.Domain.Authorization;
using AuthzPlane.Domain.Reconciliation;
using AuthzPlane.Domain.Tenants;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuthzPlane.Infrastructure.Persistence.Configurations;

internal sealed class ReconcileRunConfiguration : IEntityTypeConfiguration<ReconcileRun>
{
    public void Configure(EntityTypeBuilder<ReconcileRun> builder)
    {
        builder.ToTable("reconcile_runs");
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Generation)
            .HasConversion(g => g.Value, v => Generation.From(v))
            .IsRequired();

        builder.Property(r => r.Trigger).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(r => r.Outcome).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(r => r.SnapshotKey).HasMaxLength(512);

        builder.HasMany(r => r.Changes)
            .WithOne()
            .HasForeignKey(c => c.RunId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(r => r.Changes).UsePropertyAccessMode(PropertyAccessMode.Field);

        // Run history is always read tenant-first, newest first.
        builder.HasIndex(r => new { r.TenantId, r.StartedAt })
            .IsDescending(false, true)
            .HasDatabaseName("ix_runs_tenant_started");
    }
}

internal sealed class ReconcileChangeConfiguration : IEntityTypeConfiguration<ReconcileChange>
{
    public void Configure(EntityTypeBuilder<ReconcileChange> builder)
    {
        builder.ToTable("reconcile_changes");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.ChangeKey)
            .HasConversion(k => k.Value, v => ChangeKey.Parse(v))
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(c => c.ResourceKind).HasConversion<string>().HasMaxLength(30).IsRequired();
        builder.Property(c => c.Operation).HasConversion<string>().HasMaxLength(10).IsRequired();
        builder.Property(c => c.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(c => c.ResourceRef).HasMaxLength(512).IsRequired();
        builder.Property(c => c.Error).HasMaxLength(4000);

        builder.HasIndex(c => c.ChangeKey).HasDatabaseName("ix_changes_change_key");
    }
}

internal sealed class DriftFindingConfiguration : IEntityTypeConfiguration<DriftFinding>
{
    public void Configure(EntityTypeBuilder<DriftFinding> builder)
    {
        builder.ToTable("drift_findings");
        builder.HasKey(d => d.Id);

        builder.Property(d => d.ResourceKind).HasConversion<string>().HasMaxLength(30).IsRequired();
        builder.Property(d => d.Severity).HasConversion<string>().HasMaxLength(10).IsRequired();
        builder.Property(d => d.ResourceRef).HasMaxLength(512).IsRequired();
        builder.Property(d => d.FieldPath).HasMaxLength(512).IsRequired();
        builder.Property(d => d.DesiredValue).HasColumnType("jsonb");
        builder.Property(d => d.ActualValue).HasColumnType("jsonb");

        // ix_drift_open: partial index. The open set is tiny next to history,
        // and "show me current drift" is the only hot query.
        builder.HasIndex(d => new { d.TenantId, d.DetectedAt })
            .IsDescending(false, true)
            .HasFilter("resolved_at IS NULL")
            .HasDatabaseName("ix_drift_open");

        builder.HasOne<ReconcileRun>()
            .WithMany()
            .HasForeignKey(d => d.RunId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class RelationTupleConfiguration : IEntityTypeConfiguration<RelationTuple>
{
    public void Configure(EntityTypeBuilder<RelationTuple> builder)
    {
        builder.ToTable("relation_tuples");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.UserRef).HasMaxLength(512).IsRequired();
        builder.Property(t => t.Relation).HasMaxLength(128).IsRequired();
        builder.Property(t => t.ObjectRef).HasMaxLength(512).IsRequired();
        builder.Property(t => t.Condition).HasColumnType("jsonb");
        builder.Property(t => t.ExternalWriteId).HasMaxLength(128);

        // Section 8.4: every tenant-scoped index leads with tenant_id.
        builder.HasIndex(t => new { t.TenantId, t.ObjectRef, t.Relation })
            .HasDatabaseName("ix_tuples_tenant_object");

        builder.HasIndex(t => new { t.TenantId, t.UserRef })
            .HasDatabaseName("ix_tuples_tenant_user");

        // A tuple is a set member: the same triple must not exist twice.
        builder.HasIndex(t => new { t.TenantId, t.UserRef, t.Relation, t.ObjectRef })
            .IsUnique()
            .HasDatabaseName("ux_tuples_triple");

        builder.HasOne<Tenant>()
            .WithMany()
            .HasForeignKey(t => t.TenantId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
