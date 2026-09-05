"use client";

import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { cn } from "@/lib/cn";
import type { ExplainNode } from "@/features/playground/schemas";

/**
 * RESOLUTION TREE (frame 15). `role="tree"` with nested `treeitem`s; every
 * item carries `aria-selected` (the focused/clicked node) and every branch
 * `aria-expanded`, toggling on click, Enter, Space, ArrowRight (expand) and
 * ArrowLeft (collapse). Children indent 28px behind a 16px left rule in the
 * control-border colour. Result is carried by the glyph word and the pill
 * text, never by colour alone.
 */

type PillKind = "union" | "direct" | "computed" | "tupleToUserset" | "decisive";

const PILL: Record<PillKind, { label: string; className: string }> = {
  union: { label: "union", className: "bg-hover text-link" },
  direct: { label: "direct", className: "bg-hover text-fg-meta" },
  computed: { label: "computed", className: "bg-hover text-fg-meta" },
  tupleToUserset: { label: "tupleToUserset", className: "bg-drift-chip text-drift" },
  decisive: { label: "decisive tuple", className: "bg-ready-chip text-ready" },
};

export function pillFor(node: ExplainNode): PillKind {
  if (node.via === "direct" && node.result === "allowed" && node.tupleId) return "decisive";
  return node.via;
}

function rowClasses(node: ExplainNode): string {
  if (node.result === "denied") {
    // One-off from the frame: failed branches take the denied-tint / denied-border tokens.
    return "border-denied-border bg-denied-tint text-fg-secondary py-[11px]";
  }
  if (pillFor(node) === "decisive") return "border-ready-border-strong bg-ready-tint text-fg py-3";
  return "border-ready-border bg-ready-tint-deep text-fg py-3";
}

function TreeNode({
  node,
  depth,
  path,
  selectedPath,
  onSelect,
}: {
  node: ExplainNode;
  depth: number;
  /** position in the tree, e.g. "0.2.0"; stable across re-renders of the same result */
  path: string;
  selectedPath: string;
  onSelect: (path: string) => void;
}) {
  const children = node.children ?? [];
  const branch = children.length > 0;
  const [expanded, setExpanded] = useState(true);
  const pill = PILL[pillFor(node)];
  const selected = selectedPath === path;

  const toggle = (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation();
    onSelect(path);
    if (branch) setExpanded((v) => !v);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLLIElement>) => {
    if (e.target !== e.currentTarget) return;
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        toggle(e);
        break;
      case "ArrowRight":
        e.preventDefault();
        e.stopPropagation();
        if (branch) setExpanded(true);
        break;
      case "ArrowLeft":
        e.preventDefault();
        e.stopPropagation();
        if (branch) setExpanded(false);
        break;
    }
  };

  const allowed = node.result === "allowed";

  return (
    <li
      role="treeitem"
      aria-expanded={branch ? expanded : undefined}
      aria-selected={selected}
      aria-level={depth}
      aria-label={`${node.node} ${node.result}`}
      tabIndex={0}
      onClick={toggle}
      onFocus={(e) => {
        if (e.target === e.currentTarget) onSelect(path);
      }}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-2 outline-none"
    >
      <div
        className={cn(
          "flex items-center gap-3 rounded-inner border px-3.5 font-mono text-[12.5px] transition-colors duration-150",
          rowClasses(node),
          branch && "cursor-pointer",
          selected && "ring-1 ring-inset ring-line-focus",
        )}
      >
        <span aria-hidden className={allowed ? "text-ready" : "text-failed"}>
          {allowed ? "✓" : "✕"}
        </span>
        <span className="sr-only">{node.result}</span>
        <span className="min-w-0 flex-1 truncate">{node.node}</span>
        {node.truncated && <span className="text-[11px] text-degraded">depth cap</span>}
        <span className={cn("rounded-chip px-2 py-[2px] text-[11px]", pill.className)}>{pill.label}</span>
        {branch && (
          <span aria-hidden className="text-[11px] text-fg-meta">
            {expanded ? "▾" : "▸"}
          </span>
        )}
      </div>
      {branch && expanded && (
        <ul role="group" className="ml-7 flex flex-col gap-2 border-l border-line-control pl-4">
          {children.map((child, i) => (
            <TreeNode
              key={`${child.node}-${i}`}
              node={child}
              depth={depth + 1}
              path={`${path}.${i}`}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ResolutionTree({ root }: { root: ExplainNode }) {
  const [selectedPath, setSelectedPath] = useState("0");
  return (
    <ul role="tree" aria-label="Resolution tree" className="flex flex-col gap-2">
      <TreeNode node={root} depth={1} path="0" selectedPath={selectedPath} onSelect={setSelectedPath} />
    </ul>
  );
}
