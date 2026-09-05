using AuthzPlane.Domain.Tenants;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuthzPlane.Infrastructure.Persistence.Configurations;

// Note: tenant query filters are NOT set here. IEntityTypeConfiguration has no
// access to the DbContext instance, and the filter must reference
// AuthzPlaneDbContext.CurrentTenantId to be re-evaluated per context. They are
// applied explicitly in AuthzPlaneDbContext.OnModelCreating, and an
// architecture test fails the build if any ITenantScoped entity is missed.

internal sealed class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> builder)
    {
        builder.ToTable("tenants");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Slug)
            .HasConversion(s => s.Value, v => TenantSlug.Create(v))
            .HasMaxLength(TenantSlug.MaxLength)
            .IsRequired();

        builder.HasIndex(t => t.Slug).IsUnique().HasDatabaseName("ux_tenants_slug");

        builder.Property(t => t.DisplayName).HasMaxLength(200).IsRequired();

        builder.Property(t => t.Generation)
            .HasConversion(g => g.Value, v => Generation.From(v))
            .IsRequired();

        builder.Property(t => t.CreatedAt).IsRequired();
    }
}

internal sealed class TenantSpecConfiguration : IEntityTypeConfiguration<TenantSpec>
{
    public void Configure(EntityTypeBuilder<TenantSpec> builder)
    {
        builder.ToTable("tenant_specs");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Generation)
            .HasConversion(g => g.Value, v => Generation.From(v))
            .IsRequired();

        builder.Property(s => s.SpecJson).HasColumnType("jsonb").IsRequired();

        builder.Property(s => s.SpecHash)
            .HasConversion(h => h.Value, v => SpecHash.Parse(v))
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(s => s.CreatedBy).HasMaxLength(320).IsRequired();

        // One spec per (tenant, generation): concurrent spec writes fail loudly
        // rather than interleaving.
        builder.HasIndex(s => new { s.TenantId, s.Generation })
            .IsUnique()
            .HasDatabaseName("ux_spec_generation");

        builder.HasOne<Tenant>()
            .WithMany()
            .HasForeignKey(s => s.TenantId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class TenantStatusConfiguration : IEntityTypeConfiguration<TenantStatus>
{
    public void Configure(EntityTypeBuilder<TenantStatus> builder)
    {
        builder.ToTable("tenant_status");

        // No surrogate key: exactly one status row per tenant.
        builder.HasKey(s => s.TenantId);

        builder.Property(s => s.ObservedGeneration)
            .HasConversion(g => g.Value, v => Generation.From(v))
            .IsRequired();

        builder.Property(s => s.Phase).HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.Property(s => s.ActualStateHash).HasMaxLength(64);
        builder.Property(s => s.LastError).HasMaxLength(4000);

        // Optimistic concurrency via Postgres' system xmin column, so two
        // workers racing on the same status row cannot silently clobber.
        // Declared as a shadow property rather than via the old
        // UseXminAsConcurrencyToken() helper, which this Npgsql version removed.
        builder.Property<uint>("xmin")
            .HasColumnName("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();

        // Hot path: "which tenants are due for a retry?"
        builder.HasIndex(s => s.NextAttemptAt).HasDatabaseName("ix_status_next_attempt");

        builder.HasOne<Tenant>()
            .WithOne()
            .HasForeignKey<TenantStatus>(s => s.TenantId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
