/**
 * Pure helpers for the OpenFGA authorization-model DSL (schema 1.1). Client-safe:
 * no server imports, no I/O. The tokenizer drives syntax colouring, the parser
 * drives the type graph, the validation caption and the fixture validator.
 */

export type TokenKind =
  | "keyword"
  | "type"
  | "relation"
  | "operator"
  | "number"
  | "punct"
  | "ident"
  | "comment"
  | "space";

export interface Token {
  kind: TokenKind;
  text: string;
}

export interface TokenLine {
  /** 1-based line number */
  n: number;
  /** leading whitespace, preserved so lines render with white-space: pre */
  indent: string;
  tokens: Token[];
}

const KEYWORDS = new Set(["model", "schema", "type", "relations", "define"]);
const OPERATORS = new Set(["or", "and", "from"]);

const LEXEME = /\s+|\d+(?:\.\d+)?|[A-Za-z_][\w-]*|#.*|[\[\]:,*]|./y;

export function tokenizeLine(raw: string, n: number): TokenLine {
  const indentMatch = /^\s*/.exec(raw);
  const indent = indentMatch ? indentMatch[0] : "";
  const rest = raw.slice(indent.length);
  const tokens: Token[] = [];
  let prevWord: string | null = null;
  let afterColon = false;

  LEXEME.lastIndex = 0;
  let m: RegExpExecArray | null;
  while (LEXEME.lastIndex < rest.length && (m = LEXEME.exec(rest)) !== null) {
    const text = m[0];
    if (/^\s+$/.test(text)) {
      tokens.push({ kind: "space", text });
      continue;
    }
    if (text.startsWith("#")) {
      tokens.push({ kind: "comment", text });
      break;
    }
    if (/^\d/.test(text)) {
      tokens.push({ kind: "number", text });
      continue;
    }
    if (/^[A-Za-z_]/.test(text)) {
      // "but not" is one operator spelled with a space.
      if (text === "but" && /^\s+not\b/.test(rest.slice(LEXEME.lastIndex))) {
        const tail = /^\s+not/.exec(rest.slice(LEXEME.lastIndex))!;
        tokens.push({ kind: "operator", text: text + tail[0] });
        LEXEME.lastIndex += tail[0].length;
        prevWord = "but not";
        continue;
      }
      let kind: TokenKind;
      if (!afterColon && KEYWORDS.has(text)) kind = "keyword";
      else if (afterColon && OPERATORS.has(text)) kind = "operator";
      else if (prevWord === "type") kind = "type";
      else if (prevWord === "define") kind = "relation";
      else kind = "ident";
      tokens.push({ kind, text });
      prevWord = text;
      continue;
    }
    if (text === ":") afterColon = true;
    tokens.push({ kind: "punct", text });
  }
  return { n, indent, tokens };
}

export function tokenize(dsl: string): TokenLine[] {
  return dsl.replace(/\r\n?/g, "\n").split("\n").map((line, i) => tokenizeLine(line, i + 1));
}

/* ------------------------------------------------------------------ parser */

export interface TupleToUserset {
  /** relation looked up on the parent object, e.g. "viewer" in "viewer from parent" */
  relation: string;
  /** relation on this type that points at the parent, e.g. "parent" */
  via: string;
}

export interface RelationDef {
  name: string;
  /** directly assignable subject types, e.g. ["user"] */
  direct: string[];
  /** computed usersets on the same type, e.g. ["editor"] */
  computed: string[];
  tupleToUserset: TupleToUserset[];
  line: number;
}

export interface TypeDef {
  name: string;
  relations: RelationDef[];
  line: number;
}

export interface ParseIssue {
  line: number;
  message: string;
}

export interface ParsedModel {
  schema: string | null;
  types: TypeDef[];
  issues: ParseIssue[];
}

function parseTerm(term: string, line: number, rel: RelationDef, issues: ParseIssue[]) {
  const direct = /^\[(.*)\]$/.exec(term);
  if (direct) {
    for (const t of direct[1]!.split(",")) {
      const name = t.trim();
      if (name) rel.direct.push(name);
    }
    return;
  }
  const ttu = /^([A-Za-z_][\w-]*)\s+from\s+([A-Za-z_][\w-]*)$/.exec(term);
  if (ttu) {
    rel.tupleToUserset.push({ relation: ttu[1]!, via: ttu[2]! });
    return;
  }
  if (/^[A-Za-z_][\w-]*$/.test(term)) {
    rel.computed.push(term);
    return;
  }
  issues.push({ line, message: `cannot parse "${term}" in define ${rel.name}` });
}

export function parseModel(dsl: string): ParsedModel {
  const lines = dsl.replace(/\r\n?/g, "\n").split("\n");
  const types: TypeDef[] = [];
  const issues: ParseIssue[] = [];
  let schema: string | null = null;
  let current: TypeDef | null = null;
  let sawModel = false;

  lines.forEach((raw, i) => {
    const n = i + 1;
    const text = raw.replace(/#.*$/, "").trim();
    if (!text) return;

    if (text === "model") {
      sawModel = true;
      return;
    }
    const schemaMatch = /^schema\s+(\S+)$/.exec(text);
    if (schemaMatch) {
      schema = schemaMatch[1]!;
      return;
    }
    const typeMatch = /^type\s+([A-Za-z_][\w-]*)$/.exec(text);
    if (typeMatch) {
      const name = typeMatch[1]!;
      if (types.some((t) => t.name === name)) issues.push({ line: n, message: `duplicate type "${name}"` });
      current = { name, relations: [], line: n };
      types.push(current);
      return;
    }
    if (text === "relations") {
      if (!current) issues.push({ line: n, message: "relations block outside a type" });
      return;
    }
    const defineMatch = /^define\s+([A-Za-z_][\w-]*)\s*:\s*(.+)$/.exec(text);
    if (defineMatch) {
      if (!current) {
        issues.push({ line: n, message: `define ${defineMatch[1]} outside a type` });
        return;
      }
      const rel: RelationDef = { name: defineMatch[1]!, direct: [], computed: [], tupleToUserset: [], line: n };
      if (current.relations.some((r) => r.name === rel.name)) {
        issues.push({ line: n, message: `duplicate relation "${rel.name}" on type ${current.name}` });
      }
      for (const term of defineMatch[2]!.split(/\s+(?:or|and|but not)\s+/)) {
        parseTerm(term.trim(), n, rel, issues);
      }
      current.relations.push(rel);
      return;
    }
    issues.push({ line: n, message: `unexpected line "${text}"` });
  });

  if (!sawModel) issues.push({ line: 1, message: "missing model header" });
  if (schema === null) issues.push({ line: 1, message: "missing schema version" });

  // Reference checks: every name a relation mentions must exist.
  const typeByName = new Map(types.map((t) => [t.name, t]));
  const relOf = (type: TypeDef, name: string) => type.relations.find((r) => r.name === name);
  for (const type of types) {
    for (const rel of type.relations) {
      for (const d of rel.direct) {
        const base = d.split(/[#:]/)[0]!;
        if (!typeByName.has(base)) issues.push({ line: rel.line, message: `unknown type "${base}" in ${type.name}.${rel.name}` });
      }
      for (const c of rel.computed) {
        if (!relOf(type, c)) issues.push({ line: rel.line, message: `unknown relation "${c}" referenced by ${type.name}.${rel.name}` });
      }
      for (const t of rel.tupleToUserset) {
        const via = relOf(type, t.via);
        if (!via) {
          issues.push({ line: rel.line, message: `unknown relation "${t.via}" in "${t.relation} from ${t.via}" on ${type.name}` });
          continue;
        }
        for (const target of via.direct) {
          const targetType = typeByName.get(target.split(/[#:]/)[0]!);
          if (targetType && !relOf(targetType, t.relation)) {
            issues.push({ line: rel.line, message: `relation "${t.relation}" is not defined on ${targetType.name} (via ${t.via})` });
          }
        }
      }
    }
  }

  return { schema, types, issues };
}

/* ----------------------------------------------------------------- summary */

export interface ModelSummary {
  types: number;
  relations: number;
  /** longest chain of userset rewrites; a purely direct relation has depth 0 */
  depth: number;
}

export function summarize(model: ParsedModel): ModelSummary {
  const typeByName = new Map(model.types.map((t) => [t.name, t]));
  const memo = new Map<string, number>();
  const visiting = new Set<string>();

  const depthOf = (type: TypeDef, rel: RelationDef): number => {
    const key = `${type.name}#${rel.name}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    if (visiting.has(key)) return 0; // cycle guard
    visiting.add(key);
    let depth = 0;
    for (const c of rel.computed) {
      const target = type.relations.find((r) => r.name === c);
      if (target) depth = Math.max(depth, 1 + depthOf(type, target));
    }
    for (const t of rel.tupleToUserset) {
      const via = type.relations.find((r) => r.name === t.via);
      for (const targetName of via?.direct ?? []) {
        const targetType = typeByName.get(targetName.split(/[#:]/)[0]!);
        const target = targetType?.relations.find((r) => r.name === t.relation);
        if (targetType && target) depth = Math.max(depth, 1 + depthOf(targetType, target));
      }
    }
    visiting.delete(key);
    memo.set(key, depth);
    return depth;
  };

  let relations = 0;
  let depth = 0;
  for (const type of model.types) {
    for (const rel of type.relations) {
      relations += 1;
      depth = Math.max(depth, depthOf(type, rel));
    }
  }
  return { types: model.types.length, relations, depth };
}

/* -------------------------------------------------------------------- diff */

/**
 * Line-level comparison of two DSL bodies. A draft line is "added" when its
 * trimmed text does not occur in the live body; a live line is "removed" when
 * it does not occur in the draft. Whitespace-only lines are never marked.
 */
export function diffDsl(live: string, draft: string): { added: Set<number>; removed: string[] } {
  const norm = (s: string) => s.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim());
  const liveLines = norm(live);
  const draftLines = norm(draft);
  const liveSet = new Set(liveLines.filter(Boolean));
  const draftSet = new Set(draftLines.filter(Boolean));
  const added = new Set<number>();
  draftLines.forEach((l, i) => {
    if (l && !liveSet.has(l)) added.add(i + 1);
  });
  const removed = liveLines.filter((l) => l && !draftSet.has(l));
  return { added, removed };
}

/** Relation names present on `type` in the draft but absent (or type absent) in live. */
export function newRelations(live: ParsedModel, draft: ParsedModel): Set<string> {
  const out = new Set<string>();
  for (const type of draft.types) {
    const before = live.types.find((t) => t.name === type.name);
    for (const rel of type.relations) {
      if (!before || !before.relations.some((r) => r.name === rel.name)) out.add(`${type.name}#${rel.name}`);
    }
  }
  return out;
}
