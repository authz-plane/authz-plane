/**
 * FNV-1a 32-bit, rendered as 8 lowercase hex chars. Deterministic and tiny,
 * so both the in-memory spec store and the client (plan query keys) can hash
 * a body without a crypto round-trip. Not for security — for identity only.
 */
export function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
