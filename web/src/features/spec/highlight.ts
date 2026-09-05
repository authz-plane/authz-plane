/**
 * Minimal YAML tokenizer for the editor's line renderer (frame 05): keys in
 * tertiary, booleans in the drift purple, numbers in the accent cyan, comments
 * in meta, everything else in the code colour. Whole-line, no state between
 * lines, so a keystroke re-renders only the line it touched.
 */
export type TokenTone = "key" | "punct" | "value" | "bool" | "number" | "comment";

export interface Token {
  text: string;
  tone: TokenTone;
}

export const TOKEN_CLASS: Record<TokenTone, string> = {
  key: "text-fg-tertiary",
  punct: "text-fg-tertiary",
  value: "text-fg-code",
  bool: "text-drift",
  number: "text-accent",
  comment: "text-fg-meta",
};

const KEY_VALUE = /^(\s*)(-\s+)?([A-Za-z_][\w.-]*)(\s*:)(\s+.*|\s*)$/;

function valueTone(value: string): TokenTone {
  const v = value.trim();
  if (/^(true|false|null|~)$/.test(v)) return "bool";
  if (/^-?\d+(\.\d+)?$/.test(v)) return "number";
  return "value";
}

export function tokenizeYamlLine(line: string): Token[] {
  if (line.length === 0) return [];
  if (/^\s*#/.test(line)) return [{ text: line, tone: "comment" }];
  const m = KEY_VALUE.exec(line);
  if (!m) return [{ text: line, tone: "value" }];
  const [, indent = "", dash = "", key = "", colon = "", rest = ""] = m;
  const tokens: Token[] = [];
  if (indent) tokens.push({ text: indent, tone: "value" });
  if (dash) tokens.push({ text: dash, tone: "punct" });
  tokens.push({ text: key + colon, tone: "key" });
  if (rest) tokens.push({ text: rest, tone: valueTone(rest) });
  return tokens;
}

/** 1-based line and column for a caret offset into `text`. */
export function caretPosition(text: string, offset: number): { line: number; col: number } {
  const before = text.slice(0, Math.max(0, offset));
  const lines = before.split("\n");
  return { line: lines.length, col: (lines[lines.length - 1]?.length ?? 0) + 1 };
}
