# ADR-015: Minimal APIs, interceptor-driven audit, and per-actor idempotency

**Status:** Accepted
**Date:** 2026-09-05

## Context

Day 2 adds the first business endpoints. Four decisions were taken that the
design document either leaves open or phrases in terms of MVC controllers.

## Decisions

### 1. Minimal APIs instead of controllers

Endpoints are static methods grouped per resource in `AuthzPlane.Api/Endpoints`,
mapped under `/v1` with `MapGroup`. Each method parses HTTP, calls one handler
or query, and maps the result. No business logic lives in the host.

Why: less ceremony than controllers, first-class OpenAPI generation in .NET 10,
and endpoint filters give the same interception points action filters would.
The design document's rule "every controller action has an authorization
attribute" becomes "every mapped endpoint declares a required permission",
enforced by an architecture test when authorization lands on day 8.

Reversible: the handlers and queries are host-agnostic; only the mapping code
would change.

### 2. Expected failures are values, not exceptions

Handlers return `Result<T>` with an `ErrorKind` (Validation, NotFound,
Conflict, PreconditionRequired, PreconditionFailed). `ProblemResults` maps each
kind to exactly one HTTP status (400, 404, 409, 428, 412) and renders RFC 9457
problem+json, with extension members such as `currentGeneration` on a 412.
`DomainException` and infrastructure faults remain exceptions and become 500s.

Why: a client can branch on status alone, handlers stay unit-testable without a
host, and nobody has to remember which exception type means which status.

### 3. Audit rows are written by an EF save interceptor

`AuditSaveChangesInterceptor` inspects the change tracker on every save and adds
`AuditEvent` rows for audited entities to the same context, so they commit or
roll back with the mutation. Handlers do not call an audit service.

Why: it cannot be forgotten by a new handler, and atomicity is structural rather
than a convention. The integration test that sends an over-long actor proves the
spec row, generation bump, outbox row and audit row roll back together.

Accepted cost: the interceptor knows which entity types are audited. Adding an
aggregate means adding a case there. That list is short and reviewed.

### 4. Idempotency keys are per actor and store the exact response bytes

`idempotency_keys` is keyed by `(actor, key)`, holds a SHA-256 of method, path
and body, and stores the response as `text`, not `jsonb`.

Why per actor: one caller's key must never replay another caller's response.
Why text: a replay must return the original bytes; `jsonb` normalises whitespace
and key order on the way in, which broke byte-equality of replays during
development. Why store the request hash: the same key with a different body is a
client bug and is rejected with 422 rather than guessed at.

Accepted cost: replays do not restore response headers other than
`Content-Type`, so a replayed 201 has no `Location`. Clients that need it can
read `id` from the body. Revisit if a client actually depends on it.

### 5. A no-op spec write is a 200 with `changed: false`

`PUT /v1/tenants/{id}/spec` compares the canonical hash of the incoming spec
with the current version. When equal it writes nothing: no row, no generation
bump, no outbox message. The response still succeeds and reports the current
generation.

Why: "save without changes" from the console must not wake the reconciler.
Combined with ADR-014 this is what keeps `Plan(desired, desired) == []` true
end to end.

## Consequences

`DELETE /v1/tenants/{id}` is deferred to day 5. It has to move the tenant into
`Deleting` and run finalizers, which needs the applier. Day 2 ships create,
list, get, status, spec history and spec update.
