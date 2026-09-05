import { CheckTupleSchema, type CheckTuple } from "./schemas";

/**
 * Batch textarea parser: one `user relation object` per line, whitespace
 * separated. Blank lines are skipped; a malformed line is reported with its
 * 1-based number so the user can fix it before anything is posted.
 */
export type ParsedBatch =
  | { ok: true; checks: CheckTuple[] }
  | { ok: false; line: number; message: string };

export function parseBatch(text: string): ParsedBatch {
  const checks: CheckTuple[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]?.trim() ?? "";
    if (!raw) continue;
    const parts = raw.split(/\s+/);
    if (parts.length !== 3) {
      return { ok: false, line: i + 1, message: `expected "user relation object", got ${parts.length} field${parts.length === 1 ? "" : "s"}` };
    }
    const parsed = CheckTupleSchema.safeParse({ user: parts[0], relation: parts[1], object: parts[2] });
    if (!parsed.success) {
      return { ok: false, line: i + 1, message: parsed.error.issues[0]?.message ?? "invalid tuple" };
    }
    checks.push(parsed.data);
  }
  if (checks.length === 0) return { ok: false, line: 0, message: "add at least one tuple" };
  return { ok: true, checks };
}
