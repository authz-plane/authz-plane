import type { DiffLine } from "@/components/ui/diff";

/**
 * Pure line diff for screens 05 and 06. LCS over lines, then adjacent
 * removed/added pairs that share a YAML key collapse into one "changed" op so
 * `clientSecretRef: old` → `clientSecretRef: new` renders amber on both sides
 * rather than as a red/green pair. Deterministic; no Date or randomness.
 */

export type DiffOpKind = "equal" | "added" | "removed" | "changed";

export interface DiffOp {
  kind: DiffOpKind;
  /** text on the A (older) side; absent for added */
  left?: string;
  /** text on the B (newer) side; absent for removed */
  right?: string;
  leftN?: number;
  rightN?: number;
}

export interface DiffSummary {
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
  /** contiguous runs of non-equal ops — what the header calls "changed fields" */
  hunks: number;
}

/** Above this many cells the DP table is not worth building; the caller gets a whole-document replace. */
const MAX_CELLS = 4_000_000;

function split(text: string): string[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  // A trailing newline should not read as an extra empty line.
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Raw LCS alignment: equal / added / removed only. */
export function alignLines(a: string, b: string): DiffOp[] {
  const A = split(a);
  const B = split(b);
  const n = A.length;
  const m = B.length;
  const ops: DiffOp[] = [];

  if (n * m > MAX_CELLS) {
    A.forEach((left, i) => ops.push({ kind: "removed", left, leftN: i + 1 }));
    B.forEach((right, j) => ops.push({ kind: "added", right, rightN: j + 1 }));
    return ops;
  }

  // lcs[i][j] = LCS length of A[i..] and B[j..]
  const w = m + 1;
  const lcs = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * w + j] = A[i] === B[j] ? lcs[(i + 1) * w + j + 1]! + 1 : Math.max(lcs[(i + 1) * w + j]!, lcs[i * w + j + 1]!);
    }
  }

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      ops.push({ kind: "equal", left: A[i], right: B[j], leftN: i + 1, rightN: j + 1 });
      i++;
      j++;
    } else if (lcs[(i + 1) * w + j]! >= lcs[i * w + j + 1]!) {
      ops.push({ kind: "removed", left: A[i], leftN: i + 1 });
      i++;
    } else {
      ops.push({ kind: "added", right: B[j], rightN: j + 1 });
      j++;
    }
  }
  while (i < n) {
    ops.push({ kind: "removed", left: A[i], leftN: i + 1 });
    i++;
  }
  while (j < m) {
    ops.push({ kind: "added", right: B[j], rightN: j + 1 });
    j++;
  }
  return ops;
}

/** `      clientSecretRef: x` → "6:clientSecretRef"; list items keep their dash so `- key:` pairs with `- key:`. */
export function yamlKey(line: string): string | null {
  const m = /^(\s*)(-\s+)?([A-Za-z_][\w.-]*)\s*:/.exec(line);
  if (!m) return null;
  return `${m[1]!.length}:${m[2] ? "-" : ""}${m[3]}`;
}

/**
 * Collapse a removed run followed by an added run into changed pairs when the
 * two runs are the same shape: equal length, every line a plain scalar key
 * (no list items) and keys matching pairwise. A replaced list item (dana's
 * tuple → mira's) stays removed + added, because that is what happened.
 */
export function pairChanges(ops: DiffOp[]): DiffOp[] {
  const out: DiffOp[] = [];
  let i = 0;
  while (i < ops.length) {
    if (ops[i]!.kind !== "removed") {
      out.push(ops[i]!);
      i++;
      continue;
    }
    const removed: DiffOp[] = [];
    while (i < ops.length && ops[i]!.kind === "removed") removed.push(ops[i++]!);
    const added: DiffOp[] = [];
    while (i < ops.length && ops[i]!.kind === "added") added.push(ops[i++]!);

    const pairable =
      removed.length === added.length &&
      removed.every((r, k) => {
        const lk = yamlKey(r.left ?? "");
        const rk = yamlKey(added[k]!.right ?? "");
        return lk !== null && lk === rk && !lk.includes(":-");
      });

    if (pairable) {
      removed.forEach((r, k) => {
        const a = added[k]!;
        out.push({ kind: "changed", left: r.left, right: a.right, leftN: r.leftN, rightN: a.rightN });
      });
    } else {
      out.push(...removed, ...added);
    }
  }
  return out;
}

export function diffLines(a: string, b: string): DiffOp[] {
  return pairChanges(alignLines(a, b));
}

export function summarize(ops: DiffOp[]): DiffSummary {
  const s: DiffSummary = { added: 0, removed: 0, changed: 0, unchanged: 0, hunks: 0 };
  let inHunk = false;
  for (const op of ops) {
    if (op.kind === "equal") {
      s.unchanged++;
      inHunk = false;
      continue;
    }
    if (!inHunk) {
      s.hunks++;
      inHunk = true;
    }
    if (op.kind === "added") s.added++;
    else if (op.kind === "removed") s.removed++;
    else s.changed++;
  }
  return s;
}

/**
 * Unified view. `context` equal lines are kept around each hunk; longer equal
 * runs collapse to a single "N unchanged lines" context row so the change
 * preview stays short. `Infinity` keeps everything.
 */
export function unifiedLines(ops: DiffOp[], context = 0): DiffLine[] {
  const out: DiffLine[] = [];
  let i = 0;
  while (i < ops.length) {
    const op = ops[i]!;
    if (op.kind !== "equal") {
      if (op.kind === "changed") {
        out.push({ kind: "changed", text: op.right ?? "", n: op.rightN });
      } else if (op.kind === "added") {
        out.push({ kind: "added", text: op.right ?? "", n: op.rightN });
      } else {
        out.push({ kind: "removed", text: op.left ?? "", n: op.leftN });
      }
      i++;
      continue;
    }
    let j = i;
    while (j < ops.length && ops[j]!.kind === "equal") j++;
    const run = ops.slice(i, j);
    if (!Number.isFinite(context)) {
      for (const e of run) out.push({ kind: "context", text: e.right ?? "", n: e.rightN });
    } else {
      const head = i === 0 ? [] : run.slice(0, context);
      const tail = j === ops.length ? [] : run.slice(Math.max(context, run.length - context));
      const hidden = run.length - head.length - tail.length;
      for (const e of head) out.push({ kind: "context", text: e.right ?? "", n: e.rightN });
      if (hidden > 0) out.push({ kind: "context", text: `${hidden} unchanged line${hidden === 1 ? "" : "s"}` });
      for (const e of tail) out.push({ kind: "context", text: e.right ?? "", n: e.rightN });
    }
    i = j;
  }
  return out;
}

/** Side-by-side panes: A shows equal/removed/changed(left), B shows equal/added/changed(right). No placeholder rows, as in frame 06. */
export function sideBySide(ops: DiffOp[]): { left: DiffLine[]; right: DiffLine[] } {
  const left: DiffLine[] = [];
  const right: DiffLine[] = [];
  for (const op of ops) {
    switch (op.kind) {
      case "equal":
        left.push({ kind: "context", text: op.left ?? "", n: op.leftN });
        right.push({ kind: "context", text: op.right ?? "", n: op.rightN });
        break;
      case "removed":
        left.push({ kind: "removed", text: op.left ?? "", n: op.leftN });
        break;
      case "added":
        right.push({ kind: "added", text: op.right ?? "", n: op.rightN });
        break;
      case "changed":
        left.push({ kind: "changed", text: op.left ?? "", n: op.leftN });
        right.push({ kind: "changed", text: op.right ?? "", n: op.rightN });
        break;
    }
  }
  return { left, right };
}

/** "3 changed fields" · "1 changed field" · "no changes". */
export function changedFieldsLabel(s: DiffSummary): string {
  if (s.hunks === 0) return "no changes";
  return `${s.hunks} changed field${s.hunks === 1 ? "" : "s"}`;
}
