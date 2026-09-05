# ADR-012: Lifecycle phase on the status row only

**Status:** Accepted
**Date:** 2026-09-04

## Context

The entity diagram in section 8.1 shows `lifecycle_phase` on `tenants` *and*
`phase` on `tenant_status`.

Section 8.2 argues, correctly, that desired and observed state belong in separate
tables because collapsing them makes the reconciler write to rows humans write
to, producing write conflicts and an unusable audit trail.

Two copies of the phase reintroduces exactly that problem in miniature: the
reconciler would write `tenant_status.phase`, and something would have to keep
`tenants.lifecycle_phase` in step.

## Decision

Phase lives only on `tenant_status`. `Tenant` holds desired state - slug, display
name, generation. `TenantStatus` holds observed state - phase, observed
generation, failure counters, retry schedule.

## Consequences

Listing tenants with their phase requires a join. On the expected scale - tens to
low thousands of tenants - this is a non-issue, and `tenant_status` is keyed by
`tenant_id` so the join is on the primary key.

If a denormalised phase is later needed for a hot list query, it should be added
as a projection maintained by the reconciler, explicitly documented as derived,
and never written by the API. It must not become a second source of truth.
