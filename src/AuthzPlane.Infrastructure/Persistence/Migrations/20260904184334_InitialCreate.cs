using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthzPlane.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "reconcile_runs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    generation = table.Column<long>(type: "bigint", nullable: false),
                    trigger = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    outcome = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    snapshot_key = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    finished_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_reconcile_runs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "tenants",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    slug = table.Column<string>(type: "character varying(63)", maxLength: 63, nullable: false),
                    display_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    generation = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tenants", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "drift_findings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    run_id = table.Column<Guid>(type: "uuid", nullable: false),
                    resource_kind = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    resource_ref = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    field_path = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    desired_value = table.Column<string>(type: "jsonb", nullable: true),
                    actual_value = table.Column<string>(type: "jsonb", nullable: true),
                    severity = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    detected_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    resolved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_drift_findings", x => x.id);
                    table.ForeignKey(
                        name: "fk_drift_findings_reconcile_runs_run_id",
                        column: x => x.run_id,
                        principalTable: "reconcile_runs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "reconcile_changes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    run_id = table.Column<Guid>(type: "uuid", nullable: false),
                    change_key = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    resource_kind = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    resource_ref = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    operation = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    ordinal = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    error = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    duration_ms = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_reconcile_changes", x => x.id);
                    table.ForeignKey(
                        name: "fk_reconcile_changes_reconcile_runs_run_id",
                        column: x => x.run_id,
                        principalTable: "reconcile_runs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "relation_tuples",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_ref = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    relation = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    object_ref = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    condition = table.Column<string>(type: "jsonb", nullable: true),
                    external_write_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_relation_tuples", x => x.id);
                    table.ForeignKey(
                        name: "fk_relation_tuples_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "tenant_specs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    generation = table.Column<long>(type: "bigint", nullable: false),
                    spec_json = table.Column<string>(type: "jsonb", nullable: false),
                    spec_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    created_by = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tenant_specs", x => x.id);
                    table.ForeignKey(
                        name: "fk_tenant_specs_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "tenant_status",
                columns: table => new
                {
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    phase = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    observed_generation = table.Column<long>(type: "bigint", nullable: false),
                    actual_state_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    last_error = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    consecutive_failures = table.Column<int>(type: "integer", nullable: false),
                    last_reconciled_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    next_attempt_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_transition_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tenant_status", x => x.tenant_id);
                    table.ForeignKey(
                        name: "fk_tenant_status_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_drift_findings_run_id",
                table: "drift_findings",
                column: "run_id");

            migrationBuilder.CreateIndex(
                name: "ix_drift_open",
                table: "drift_findings",
                columns: new[] { "tenant_id", "detected_at" },
                descending: new[] { false, true },
                filter: "resolved_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_changes_change_key",
                table: "reconcile_changes",
                column: "change_key");

            migrationBuilder.CreateIndex(
                name: "ix_reconcile_changes_run_id",
                table: "reconcile_changes",
                column: "run_id");

            migrationBuilder.CreateIndex(
                name: "ix_runs_tenant_started",
                table: "reconcile_runs",
                columns: new[] { "tenant_id", "started_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "ix_tuples_tenant_object",
                table: "relation_tuples",
                columns: new[] { "tenant_id", "object_ref", "relation" });

            migrationBuilder.CreateIndex(
                name: "ix_tuples_tenant_user",
                table: "relation_tuples",
                columns: new[] { "tenant_id", "user_ref" });

            migrationBuilder.CreateIndex(
                name: "ux_tuples_triple",
                table: "relation_tuples",
                columns: new[] { "tenant_id", "user_ref", "relation", "object_ref" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_spec_generation",
                table: "tenant_specs",
                columns: new[] { "tenant_id", "generation" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_status_next_attempt",
                table: "tenant_status",
                column: "next_attempt_at");

            migrationBuilder.CreateIndex(
                name: "ux_tenants_slug",
                table: "tenants",
                column: "slug",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "drift_findings");

            migrationBuilder.DropTable(
                name: "reconcile_changes");

            migrationBuilder.DropTable(
                name: "relation_tuples");

            migrationBuilder.DropTable(
                name: "tenant_specs");

            migrationBuilder.DropTable(
                name: "tenant_status");

            migrationBuilder.DropTable(
                name: "reconcile_runs");

            migrationBuilder.DropTable(
                name: "tenants");
        }
    }
}
