# Architecture decision records

ADR-001 to ADR-010 are listed in [system-design.md](../system-design.md) section 17
and are written as the features they describe land.

The records below cover decisions taken while building the day-1 scaffold that
depart from the design document. They are here so the divergence is deliberate
and reviewable rather than discovered later by someone reading the code.

| ADR | Title | Status |
|---|---|---|
| [011](011-single-image-two-runtime-roles.md) | Single image, two runtime roles instead of a separate Reconciler project | Accepted |
| [012](012-phase-on-status-row-only.md) | Lifecycle phase on the status row only | Accepted |
| [014](014-canonical-json-before-hashing.md) | Canonical JSON before spec hashing | Accepted |
