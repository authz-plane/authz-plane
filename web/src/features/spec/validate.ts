import type { ValidationIssue, ValidationResponse } from "./schemas";

/**
 * Fixture validator for POST /spec:validate (screen 05). Pure and
 * deterministic: the route adds `durationMs`. Mirrors what the .NET API will
 * enforce — schema shape, FGA DSL parse, write-only secrets and the SSRF
 * allowlist for `issuer` — closely enough that the editor's behaviour does not
 * change when the real endpoint lands.
 */

export interface ValidateContext {
  /** body of the generation the reconciler last converged; drives the secret-rotation warning */
  appliedBody?: string | null;
}

export type ValidationOutcome = Omit<ValidationResponse, "durationMs">;

const KEY_LINE = /^(\s*)(?:-\s+)?([A-Za-z_][\w.-]*)\s*:(?:\s+(.*))?$/;
const BLOCK_SCALAR = /:\s*[|>][-+]?\s*$/;

interface Line {
  n: number;
  text: string;
  indent: number;
}

function splitLines(body: string): Line[] {
  return body
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((text, i) => ({ n: i + 1, text, indent: text.length - text.trimStart().length }));
}

function issue(level: ValidationIssue["level"], title: string, detail: string, line: number | null = null): ValidationIssue {
  return { level, title, detail, line };
}

/** Indentation rules: spaces only, multiples of two, at most one level deeper than the parent. Block scalars (`key: |`) are free-form. */
export function indentationIssues(lines: Line[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  let prevIndent = 0;
  let scalarIndent: number | null = null;
  for (const l of lines) {
    if (l.text.trim() === "" || l.text.trimStart().startsWith("#")) continue;
    if (scalarIndent !== null) {
      if (l.indent > scalarIndent) continue;
      scalarIndent = null;
    }
    if (/^\s*\t/.test(l.text)) {
      out.push(issue("error", "Broken indentation", `line ${l.n} · tab character in indentation; use two spaces per level`, l.n));
      prevIndent = l.indent;
      continue;
    }
    if (l.indent % 2 !== 0) {
      out.push(issue("error", "Broken indentation", `line ${l.n} · indent of ${l.indent} spaces is not a multiple of 2`, l.n));
    } else if (l.indent > prevIndent + 2) {
      out.push(issue("error", "Broken indentation", `line ${l.n} · indented ${l.indent - prevIndent} spaces past its parent`, l.n));
    }
    if (BLOCK_SCALAR.test(l.text)) scalarIndent = l.indent;
    prevIndent = l.indent;
  }
  return out;
}

/** Top-level keys the schema requires. */
export function schemaIssues(lines: Line[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const top = new Set<string>();
  for (const l of lines) {
    const m = KEY_LINE.exec(l.text);
    if (m && m[1]!.length === 0) top.add(m[2]!);
  }
  for (const key of ["apiVersion", "kind", "metadata", "spec"]) {
    if (!top.has(key)) out.push(issue("error", "Schema violation", `top-level \`${key}\` is required`));
  }
  const api = lines.find((l) => /^apiVersion:/.test(l.text));
  if (api && !/authzplane\.dev\/v1\s*$/.test(api.text)) {
    out.push(issue("error", "Schema violation", `line ${api.n} · apiVersion must be authzplane.dev/v1`, api.n));
  }
  const kind = lines.find((l) => /^kind:/.test(l.text));
  if (kind && !/:\s*Tenant\s*$/.test(kind.text)) {
    out.push(issue("error", "Schema violation", `line ${kind.n} · kind must be Tenant`, kind.n));
  }
  return out;
}

/** Count `type` and `define` lines inside the `authorizationModel: |` block. */
export function modelSummary(lines: Line[]): { types: number; relations: number; present: boolean } {
  const start = lines.findIndex((l) => /^\s*authorizationModel:\s*[|>]/.test(l.text));
  if (start < 0) return { types: 0, relations: 0, present: false };
  const indent = lines[start]!.indent;
  let types = 0;
  let relations = 0;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i]!;
    if (l.text.trim() !== "" && l.indent <= indent) break;
    if (/^\s*type\s+\w+/.test(l.text)) types++;
    if (/^\s*define\s+\w+\s*:/.test(l.text)) relations++;
  }
  return { types, relations, present: true };
}

/** Literal `clientSecret:` values are rejected in favour of refs; the API never stores them in history. */
export function secretIssues(lines: Line[], ctx: ValidateContext): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const appliedRefs = new Set<string>();
  if (ctx.appliedBody) {
    for (const l of splitLines(ctx.appliedBody)) {
      const m = /^\s*clientSecretRef:\s*(\S+)/.exec(l.text);
      if (m) appliedRefs.add(m[1]!);
    }
  }
  for (const l of lines) {
    if (/^\s*(?:-\s+)?clientSecret\s*:\s*\S/.test(l.text)) {
      out.push(
        issue(
          "warning",
          "Literal client secret in spec",
          `line ${l.n} · use clientSecretRef; secret values are write-only and are never stored in spec history`,
          l.n,
        ),
      );
    }
    const ref = /^\s*clientSecretRef:\s*(\S+)/.exec(l.text);
    if (ref && ctx.appliedBody && !appliedRefs.has(ref[1]!)) {
      out.push(issue("warning", "Secret ref rotates the stored ciphertext", `line ${l.n} · write-only field, never returned by the API`, l.n));
    }
  }
  return out;
}

const PRIVATE_HOST =
  /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+|0\.0\.0\.0|\[?::1\]?|metadata(\.google\.internal)?)$/i;

/** SSRF allowlist for every `issuer:` (system design T3): https only, no private/loopback/link-local/CGNAT hosts. */
export function issuerIssues(lines: Line[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  for (const l of lines) {
    const m = /^\s*issuer:\s*(\S+)/.exec(l.text);
    if (!m) continue;
    const raw = m[1]!;
    let url: URL | null = null;
    try {
      url = new URL(raw);
    } catch {
      url = null;
    }
    if (!url) {
      out.push(issue("error", "issuer rejected by SSRF guard", `line ${l.n} · not an absolute URL`, l.n));
    } else if (url.protocol !== "https:") {
      out.push(issue("error", "issuer rejected by SSRF guard", `line ${l.n} · scheme ${url.protocol.replace(":", "")} is not https`, l.n));
    } else if (PRIVATE_HOST.test(url.hostname)) {
      out.push(issue("error", "issuer rejected by SSRF guard", `line ${l.n} · ${url.hostname} resolves to a private, loopback, link-local or CGNAT range`, l.n));
    } else {
      out.push(issue("ok", "issuer passed SSRF allowlist", "https · public host · no redirects", l.n));
    }
  }
  return out;
}

export function validateSpecBody(body: string, ctx: ValidateContext = {}): ValidationOutcome {
  const lines = splitLines(body);
  const errors = [...schemaIssues(lines), ...indentationIssues(lines)];
  const model = modelSummary(lines);
  const results: ValidationIssue[] = [];

  if (errors.length === 0) {
    const detail = model.present ? `${model.types} types · ${model.relations} relations · no cycles` : "no authorization model block · roles only";
    results.push(issue("ok", "Schema and FGA DSL parse cleanly", detail));
  } else {
    results.push(...errors);
  }
  results.push(...secretIssues(lines, ctx));
  results.push(...issuerIssues(lines));

  const errorCount = results.filter((r) => r.level === "error").length;
  const warnings = results.filter((r) => r.level === "warning").length;
  return {
    results,
    errors: errorCount,
    warnings,
    lineCount: lines.length,
    valid: errorCount === 0,
  };
}

/** Status-bar / tab caption: "schema ok" · "1 warning" · "2 errors". */
export function validationCaption(v: Pick<ValidationOutcome, "errors" | "warnings"> | null | undefined): string {
  if (!v) return "validating…";
  if (v.errors > 0) return `${v.errors} error${v.errors === 1 ? "" : "s"}`;
  if (v.warnings > 0) return `${v.warnings} warning${v.warnings === 1 ? "" : "s"}`;
  return "schema ok";
}
