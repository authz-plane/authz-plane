# authz-plane

A multi-tenant authorization control plane: tenants declare desired state, and a
reconciler converges an identity provider and an authorization store towards it,
detecting and reporting drift in between.

> **Not production software.** This is a portfolio project built to explore
> control-plane patterns. It has no security review, no operational history, and
> no support.

## Why it looks like this

The interesting problems here are the ones that survive failure:

- **Desired and observed state are separate tables.** `tenant_specs` is
  append-only - a git-like history of intent. `tenant_status` is one mutable row
  per tenant that only the reconciler writes. Collapsing them would mean the
  reconciler writing to rows humans write to.
- **Every intended mutation has a deterministic `changeKey`.** Replaying a key
  that has already been applied is a no-op read, not a duplicate create. Retry
  and partial teardown both depend on this.
- **Backoff is a pure function.** `BackoffPolicy.DelayFor(attempt, jitter)` reads
  no clock and no RNG, so the entire retry curve is asserted in microseconds
  instead of slept through.
- **Tenant isolation is enforced by a test, not by discipline.** A global EF
  query filter is required on every `ITenantScoped` entity, and an architecture
  test walks the built model and fails the build if one is missing.

## Status: day 1

Domain and persistence foundation. What exists:

| Area | State |
|---|---|
| Domain entities, value objects, lifecycle state machine | done |
| Backoff policy with injected jitter | done |
| EF Core model, first migration, tenant query filters | done, applied against Postgres 17 |
| Architecture tests: layering, tenant isolation, no ambient clock | done |
| CI: format, build, test, migration-drift, secret scan | done |
| Tenant CRUD API, outbox, audit | day 2 |
| Gateways, planner, applier, drift detection | days 3-6 |

**92 tests passing.** Coverage is not gated yet - with almost no application code
a percentage target would measure nothing. The gate lands on day 2, on
`Domain` + `Application` only, per section 13.3.

## Running it

```bash
docker compose up -d                # Postgres on host port 5433, Redis on 6379
dotnet tool restore
dotnet tool run dotnet-ef database update \
  --project src/AuthzPlane.Infrastructure \
  --startup-project src/AuthzPlane.Api
dotnet run --project src/AuthzPlane.Api
```

Then `GET /healthz` and `GET /readyz`.

> Postgres is published on **5433**, not 5432. A native PostgreSQL service
> commonly owns 5432 on a developer machine, and Docker will publish onto a
> shadowed port without complaint, so connections silently reach the wrong
> database. Override with `AUTHZPLANE_PG_PORT`.

```bash
dotnet build AuthzPlane.slnx        # warnings are errors
dotnet test AuthzPlane.slnx
dotnet format AuthzPlane.slnx --verify-no-changes
```

## Layout

```
src/
  AuthzPlane.Domain/          entities, value objects, invariants - no dependencies
  AuthzPlane.Application/     use cases and ports - depends only on Domain
  AuthzPlane.Infrastructure/  EF Core, adapters - depends on Application
  AuthzPlane.Api/             HTTP host + background workers, DI composition
tests/
  AuthzPlane.Domain.UnitTests/
  AuthzPlane.Application.UnitTests/
  AuthzPlane.Architecture.Tests/
docs/
  system-design.md            the full design document
  adr/                        decision records
  db/migrations.sql           idempotent script, diffed in CI
```

Four projects, not the six in section 16 of the design document - see
[ADR-011](docs/adr/011-single-image-two-runtime-roles.md).

## Branching

Trunk-based on a single `dev` branch. Short-lived branches, squash merges,
Conventional Commits on PR titles, linear history.

Branch protection requires status checks, linear history and signed commits.
It does **not** require review approval: this is a solo repository, GitHub
forbids self-approval, and claiming peer review would be false.

---

Built by [Raj Kolekar](https://github.com/Raj-Kolekar).
