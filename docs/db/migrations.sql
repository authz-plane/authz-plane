CREATE TABLE IF NOT EXISTS __ef_migrations_history (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT "PK___ef_migrations_history" PRIMARY KEY ("MigrationId")
);

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260904184334_InitialCreate') THEN
    CREATE TABLE reconcile_runs (
        id uuid NOT NULL,
        tenant_id uuid NOT NULL,
        generation bigint NOT NULL,
        trigger character varying(20) NOT NULL,
        outcome character varying(20) NOT NULL,
        snapshot_key character varying(512),
        started_at timestamp with time zone NOT NULL,
        finished_at timestamp with time zone,
        CONSTRAINT pk_reconcile_runs PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260904184334_InitialCreate') THEN
    CREATE TABLE tenants (
        id uuid NOT NULL,
        slug character varying(63) NOT NULL,
        display_name character varying(200) NOT NULL,
        generation bigint NOT NULL,
        created_at timestamp with time zone NOT NULL,
        deleted_at timestamp with time zone,
        CONSTRAINT pk_tenants PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260904184334_InitialCreate') THEN
    CREATE TABLE drift_findings (
        id uuid NOT NULL,
        tenant_id uuid NOT NULL,
        run_id uuid NOT NULL,
        resource_kind character varying(30) NOT NULL,
        resource_ref character varying(512) NOT NULL,
        field_path character varying(512) NOT NULL,
        desired_value jsonb,
        actual_value jsonb,
        severity character varying(10) NOT NULL,
        detected_at timestamp with time zone NOT NULL,
        resolved_at timestamp with time zone,
        CONSTRAINT pk_drift_findings PRIMARY KEY (id),
        CONSTRAINT fk_drift_findings_reconcile_runs_run_id FOREIGN KEY (run_id) REFERENCES reconcile_runs (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260904184334_InitialCreate') THEN
    CREATE TABLE reconcile_changes (
        id uuid NOT NULL,
        run_id uuid NOT NULL,
        change_key character varying(64) NOT NULL,
        resource_kind character varying(30) NOT NULL,
        resource_ref character varying(512) NOT NULL,
        operation character varying(10) NOT NULL,
        ordinal integer NOT NULL,
        status character varying(20) NOT NULL,
        error character varying(4000),
        duration_ms integer,
        CONSTRAINT pk_reconcile_changes PRIMARY KEY (id),
        CONSTRAINT fk_reconcile_changes_reconcile_runs_run_id FOREIGN KEY (run_id) REFERENCES reconcile_runs (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260904184334_InitialCreate') THEN
    CREATE TABLE relation_tuples (
        id uuid NOT NULL,
        tenant_id uuid NOT NULL,
        user_ref character varying(512) NOT NULL,
        relation character varying(128) NOT NULL,
        object_ref character varying(512) NOT NULL,
        condition jsonb,
        external_write_id character varying(128),
        created_at timestamp with time zone NOT NULL,
        CONSTRAINT pk_relation_tuples PRIMARY KEY (id),
        CONSTRAINT fk_relation_tuples_tenants_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260904184334_InitialCreate') THEN
    CREATE TABLE tenant_specs (
        id uuid NOT NULL,
        tenant_id uuid NOT NULL,
        generation bigint NOT NULL,
        spec_json jsonb NOT NULL,
        spec_hash character varying(64) NOT NULL,
        created_by character varying(320) NOT NULL,
        created_at timestamp with time zone NOT NULL,
        CONSTRAINT pk_tenant_specs PRIMARY KEY (id),
        CONSTRAINT fk_tenant_specs_tenants_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260904184334_InitialCreate') THEN
    CREATE TABLE tenant_status (
        tenant_id uuid NOT NULL,
        phase character varying(20) NOT NULL,
        observed_generation bigint NOT NULL,
        actual_state_hash character varying(64),
        last_error character varying(4000),
        consecutive_failures integer NOT NULL,
        last_reconciled_at timestamp with time zone,
        next_attempt_at timestamp with time zone,
        last_transition_at timestamp with time zone NOT NULL,
        CONSTRAINT pk_tenant_status PRIMARY KEY (tenant_id),
        CONSTRAINT fk_tenant_status_tenants_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260904184334_InitialCreate') THEN
    CREATE INDEX ix_drift_findings_run_id ON drift_findings (run_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260904184334_InitialCreate') THEN
    CREATE INDEX ix_drift_open ON drift_findings (tenant_id, detected_at DESC) WHERE resolved_at IS NULL;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260904184334_InitialCreate') THEN
    CREATE INDEX ix_changes_change_key ON reconcile_changes (change_key);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260904184334_InitialCreate') THEN
    CREATE INDEX ix_reconcile_changes_run_id ON reconcile_changes (run_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260904184334_InitialCreate') THEN
    CREATE INDEX ix_runs_tenant_started ON reconcile_runs (tenant_id, started_at DESC);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260904184334_InitialCreate') THEN
    CREATE INDEX ix_tuples_tenant_object ON relation_tuples (tenant_id, object_ref, relation);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260904184334_InitialCreate') THEN
    CREATE INDEX ix_tuples_tenant_user ON relation_tuples (tenant_id, user_ref);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260904184334_InitialCreate') THEN
    CREATE UNIQUE INDEX ux_tuples_triple ON relation_tuples (tenant_id, user_ref, relation, object_ref);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260904184334_InitialCreate') THEN
    CREATE UNIQUE INDEX ux_spec_generation ON tenant_specs (tenant_id, generation);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260904184334_InitialCreate') THEN
    CREATE INDEX ix_status_next_attempt ON tenant_status (next_attempt_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260904184334_InitialCreate') THEN
    CREATE UNIQUE INDEX ux_tenants_slug ON tenants (slug);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260904184334_InitialCreate') THEN
    INSERT INTO __ef_migrations_history ("MigrationId", "ProductVersion")
    VALUES ('20260904184334_InitialCreate', '10.0.11');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260905061329_AddOutboxAuditIdempotency') THEN
    CREATE TABLE audit_events (
        id uuid NOT NULL,
        tenant_id uuid NOT NULL,
        actor character varying(320) NOT NULL,
        action character varying(100) NOT NULL,
        resource_type character varying(100) NOT NULL,
        resource_id character varying(512) NOT NULL,
        before jsonb,
        after jsonb,
        request_id character varying(64),
        trace_id character varying(64),
        occurred_at timestamp with time zone NOT NULL,
        CONSTRAINT pk_audit_events PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260905061329_AddOutboxAuditIdempotency') THEN
    CREATE TABLE idempotency_keys (
        actor character varying(320) NOT NULL,
        key character varying(128) NOT NULL,
        request_hash character varying(64) NOT NULL,
        status_code integer NOT NULL,
        content_type character varying(100),
        response_body text,
        created_at timestamp with time zone NOT NULL,
        expires_at timestamp with time zone NOT NULL,
        CONSTRAINT pk_idempotency_keys PRIMARY KEY (actor, key)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260905061329_AddOutboxAuditIdempotency') THEN
    CREATE TABLE outbox_messages (
        id uuid NOT NULL,
        tenant_id uuid NOT NULL,
        type character varying(100) NOT NULL,
        payload jsonb NOT NULL,
        attempts integer NOT NULL,
        last_error character varying(4000),
        last_failed_at timestamp with time zone,
        created_at timestamp with time zone NOT NULL,
        claimed_at timestamp with time zone,
        processed_at timestamp with time zone,
        CONSTRAINT pk_outbox_messages PRIMARY KEY (id),
        CONSTRAINT fk_outbox_messages_tenants_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260905061329_AddOutboxAuditIdempotency') THEN
    CREATE INDEX ix_audit_tenant_time ON audit_events (tenant_id, occurred_at DESC);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260905061329_AddOutboxAuditIdempotency') THEN
    CREATE INDEX ix_idempotency_expires ON idempotency_keys (expires_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260905061329_AddOutboxAuditIdempotency') THEN
    CREATE INDEX ix_outbox_messages_tenant_id ON outbox_messages (tenant_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260905061329_AddOutboxAuditIdempotency') THEN
    CREATE INDEX ix_outbox_pending ON outbox_messages (created_at) WHERE processed_at IS NULL;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "MigrationId" = '20260905061329_AddOutboxAuditIdempotency') THEN
    INSERT INTO __ef_migrations_history ("MigrationId", "ProductVersion")
    VALUES ('20260905061329_AddOutboxAuditIdempotency', '10.0.11');
    END IF;
END $EF$;
COMMIT;

