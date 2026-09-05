# ADR-011: Single image, two runtime roles instead of a separate Reconciler project

**Status:** Accepted
**Date:** 2026-09-04

## Context

Section 16 of the design document specifies six projects under `src/`, including
`AuthzPlane.Reconciler` as a separate host and `AuthzPlane.Contracts` for DTOs.

The reconciler and the API share nearly everything: the same domain, the same
ports, the same EF model, the same configuration. What differs is which entry
points are active, not what code is loaded.

`Contracts` had exactly one plausible consumer, a .NET client SDK. The UI client
is generated from OpenAPI, so that consumer does not exist.

## Options considered

1. **Six projects as specified.** Faithful to the document. Two build outputs,
   two Dockerfiles, two image builds in CI, two things to keep in version step.
2. **Four projects, workers hosted in the API.** Workers become
   `BackgroundService` implementations inside `AuthzPlane.Api`, gated on
   `Workers:Enabled`. One image is deployed twice with different configuration:
   the `api` deployment takes ingress with workers off, the `reconciler`
   deployment runs workers with probes only and no ingress.
3. **Four projects, single deployment doing both.** Simplest, but a slow
   reconcile loop would then compete with request latency, and the two cannot be
   scaled independently.

## Decision

Option 2. Four projects, two runtime roles, one artefact.

DTOs live in `AuthzPlane.Api/Contracts/`. Application keeps its own command,
query and result types, and mapping happens at the boundary.

## Consequences

**Accepted cost.** The two roles share a dependency graph, so a package needed
only by the workers is also present in the API image. At this size that is a few
megabytes, not an architectural problem.

**The real risk.** If both deployments are configured with
`Workers__Enabled=true`, two reconcile loops run concurrently. This is *safe* -
the per-tenant `pg_advisory_xact_lock` means the second worker skips rather than
duplicating work - but it is wasted capacity and confusing in traces. The Helm
chart owns this invariant and must set the flag explicitly per deployment rather
than relying on a shared default.

**Reversible.** Extracting a `Reconciler` host later is mechanical: move the
`BackgroundService` registrations into a new host project. Nothing in the domain
or application layer depends on which process it runs in.
