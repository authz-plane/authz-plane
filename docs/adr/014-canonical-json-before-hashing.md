# ADR-014: Canonical JSON before spec hashing

**Status:** Accepted
**Date:** 2026-09-04

## Context

`SpecHash` identifies a version of desired state. The no-op invariant -
`Plan(d, d) == []` - is what stops the reconciler flapping between two states and
triggering retry storms.

A hash taken over raw JSON text is sensitive to things that carry no meaning:

- key order, which differs between clients and serialisers
- insignificant whitespace, so a pretty-printed spec hashes differently from a
  compact one that says the same thing

If two semantically identical specs hash differently, every reconcile pass sees a
spurious change. Worse, it fails *silently*: nothing errors, the system simply
never settles.

## Options considered

1. **Hash the raw text.** Simplest, and wrong for the reason above.
2. **Hash a canonical rendering.** Sort object keys, strip insignificant
   whitespace, preserve array order.
3. **Full JCS (RFC 8785).** Also canonicalises number formats and string escapes.

## Decision

Option 2, implemented in `SpecHash.Canonicalise`. Object keys are sorted by
ordinal, whitespace is stripped, and array order is preserved because order is
semantically meaningful in a spec (a list of roles is ordered).

The canonical form is what gets persisted to `tenant_specs.spec_json`, so the
stored bytes and the stored hash always agree.

## Consequences

**Known gap.** JSON number formats are preserved verbatim, so `1` and `1.0` hash
differently. Full JCS number canonicalisation requires a decision about precision
and round-tripping that belongs at the API boundary, not inside a hash function.
The API should normalise or reject ambiguous numeric forms on write.

**Tested.** `SpecHashTests` asserts key-order independence, whitespace
independence, nested-object key ordering, and that array order deliberately
*does* affect the hash. Those tests are the regression guard on the no-op
invariant.
