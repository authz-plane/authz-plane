import type {
  BatchCheckResponse,
  CheckTuple,
  Consistency,
  DecisiveTuple,
  ExplainNode,
  ExplainResponse,
} from "./schemas";

/**
 * A tiny deterministic ReBAC resolver over an OpenFGA-style model. Pure and
 * client-safe so tests can drive it directly; `server.ts` binds it to the
 * fixture model + tuple set. Only `union` rewrites exist (direct | computed
 * userset | tuple-to-userset), which is all the fixture models use.
 */

export interface RelationDef {
  /** `[user]` / `[folder]`: tuples may be written directly */
  direct?: boolean;
  /** `or editor`: the same object, another relation */
  computed?: string[];
  /** `editor from parent`: follow `tupleset` tuples, then check `relation` on the target */
  tupleToUserset?: Array<{ tupleset: string; relation: string }>;
}

/** type -> relation -> definition */
export type AuthorizationModel = Record<string, Record<string, RelationDef>>;

export interface StoredTuple {
  object: string;
  relation: string;
  user: string;
  tupleId: string;
  writtenAt: string;
  writtenBy: string;
  auditEventId: string;
}

export interface ResolverOptions {
  now: string;
  modelVersion: number;
  consistency: Consistency;
  includeProvenance?: boolean;
}

/** Recursion cap from the frame's "Max depth 3 / 8 cap". */
export const DEPTH_CAP = 8;

export function typeOf(ref: string): string {
  return ref.split(":")[0] ?? ref;
}

export function idOf(ref: string): string {
  const i = ref.indexOf(":");
  return i === -1 ? ref : ref.slice(i + 1);
}

/** Every relation name the model defines, in first-seen order. */
export function relationsOf(model: AuthorizationModel): string[] {
  const seen = new Set<string>();
  for (const type of Object.values(model)) {
    for (const relation of Object.keys(type)) seen.add(relation);
  }
  return [...seen];
}

interface Ctx {
  nodes: number;
  maxDepth: number;
  depthCapHit: boolean;
  decisive: DecisiveTuple | null;
  decisiveObject: string;
  decisiveRelation: string;
}

export function explain(
  model: AuthorizationModel,
  tuples: readonly StoredTuple[],
  check: CheckTuple,
  opts: ResolverOptions,
): ExplainResponse {
  const includeProvenance = opts.includeProvenance ?? true;
  const ctx: Ctx = {
    nodes: 0,
    maxDepth: 0,
    depthCapHit: false,
    decisive: null,
    decisiveObject: "",
    decisiveRelation: "",
  };

  const find = (object: string, relation: string, user: string) =>
    tuples.find((t) => t.object === object && t.relation === relation && t.user === user);

  const visit = (depth: number) => {
    ctx.nodes += 1;
    if (depth > ctx.maxDepth) ctx.maxDepth = depth;
  };

  const directLeaf = (object: string, relation: string, user: string, depth: number, via: "direct" | "computed"): ExplainNode => {
    visit(depth);
    const hit = find(object, relation, user);
    const node: ExplainNode = {
      node: via === "direct" ? `${object}#${relation}@${user}` : `${object}#${relation}`,
      result: hit ? "allowed" : "denied",
      via,
    };
    if (hit) {
      if (includeProvenance) {
        node.tupleId = hit.tupleId;
        node.writtenAt = hit.writtenAt;
        node.writtenBy = hit.writtenBy;
        node.auditEventId = hit.auditEventId;
      }
      if (!ctx.decisive) {
        ctx.decisive = {
          node: `${object}#${relation}@${user}`,
          tupleId: hit.tupleId,
          writtenAt: hit.writtenAt,
          writtenBy: hit.writtenBy,
          auditEventId: hit.auditEventId,
        };
        ctx.decisiveObject = object;
        ctx.decisiveRelation = relation;
      }
    }
    return node;
  };

  const evaluate = (object: string, relation: string, user: string, depth: number, reachedVia: "direct" | "computed"): ExplainNode => {
    if (depth > DEPTH_CAP) {
      ctx.depthCapHit = true;
      return { node: `${object}#${relation}`, result: "denied", via: reachedVia, truncated: true };
    }
    const def = model[typeOf(object)]?.[relation];
    if (!def) {
      // Unknown type or relation: nothing can grant it.
      visit(depth);
      return { node: `${object}#${relation}`, result: "denied", via: reachedVia };
    }
    const branchCount = (def.direct ? 1 : 0) + (def.computed?.length ?? 0) + (def.tupleToUserset?.length ?? 0);
    if (branchCount === 1 && def.direct) {
      return directLeaf(object, relation, user, depth, reachedVia);
    }

    visit(depth);
    const children: ExplainNode[] = [];
    if (def.direct) children.push(directLeaf(object, relation, user, depth + 1, "direct"));
    for (const other of def.computed ?? []) {
      children.push(evaluate(object, other, user, depth + 1, "computed"));
    }
    for (const ttu of def.tupleToUserset ?? []) {
      visit(depth + 1);
      const targets = tuples.filter((t) => t.object === object && t.relation === ttu.tupleset).map((t) => t.user);
      const viaChildren = targets.map((target) => evaluate(target, ttu.relation, user, depth + 2, "direct"));
      const node: ExplainNode = {
        node: `${object}#${ttu.tupleset}`,
        result: viaChildren.some((c) => c.result === "allowed") ? "allowed" : "denied",
        via: "tupleToUserset",
      };
      if (viaChildren.length > 0) node.children = viaChildren;
      children.push(node);
    }
    return {
      node: `${object}#${relation}`,
      result: children.some((c) => c.result === "allowed") ? "allowed" : "denied",
      via: reachedVia === "computed" ? "computed" : "union",
      children,
    };
  };

  const tree = evaluate(check.object, check.relation, check.user, 1, "direct");
  const allowed = tree.result === "allowed";
  const strong = opts.consistency === "strong";

  return {
    allowed,
    checkedAt: opts.now,
    // Deterministic: strong consistency bypasses the decision cache.
    durationMs: strong ? 7 : 2,
    cached: !strong,
    consistency: opts.consistency,
    modelVersion: opts.modelVersion,
    tree,
    decisive: allowed ? ctx.decisive : null,
    reason: reasonFor(check, ctx, allowed),
    stats: {
      nodesEvaluated: ctx.nodes,
      maxDepth: Math.min(ctx.maxDepth, DEPTH_CAP),
      depthCap: DEPTH_CAP,
      depthCapHit: ctx.depthCapHit,
      fgaCalls: 1,
    },
  };
}

export function batchCheck(
  model: AuthorizationModel,
  tuples: readonly StoredTuple[],
  checks: readonly CheckTuple[],
  opts: ResolverOptions,
): BatchCheckResponse {
  return {
    checkedAt: opts.now,
    consistency: opts.consistency,
    modelVersion: opts.modelVersion,
    results: checks.map((c) => {
      const r = explain(model, tuples, c, { ...opts, includeProvenance: false });
      return { ...c, allowed: r.allowed, durationMs: r.durationMs };
    }),
  };
}

/* ---------- plain-language reason ---------- */

const VERBS: Record<string, string> = {
  viewer: "view",
  editor: "edit",
  owner: "own",
  auditor: "audit",
  admin: "administer",
  member: "be a member of",
  parent: "be a parent of",
};

function verbFor(relation: string): string {
  return VERBS[relation] ?? `hold ${relation} on`;
}

function articleFor(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

function plural(word: string): string {
  return word.endsWith("s") ? word : `${word}s`;
}

function reasonFor(check: CheckTuple, ctx: Ctx, allowed: boolean): string {
  const who = idOf(check.user);
  const what = idOf(check.object);
  const verb = verbFor(check.relation);
  if (!allowed || !ctx.decisive) {
    const base = `${who} cannot ${verb} ${what}: no tuple grants ${check.relation} on ${check.object} to ${check.user}, directly or through a parent.`;
    return ctx.depthCapHit ? `${base} Resolution stopped at the depth cap of ${DEPTH_CAP}.` : base;
  }
  const rel = ctx.decisiveRelation;
  const obj = ctx.decisiveObject;
  if (obj === check.object && rel === check.relation) {
    return `${who} can ${verb} ${what} because ${who} is ${articleFor(rel)} ${rel} of ${obj} directly.`;
  }
  if (obj === check.object) {
    return `${who} can ${verb} ${what} because ${who} is ${articleFor(rel)} ${rel} of ${obj}, and ${typeOf(obj)} ${plural(rel)} are also ${plural(check.relation)}.`;
  }
  return `${who} can ${verb} ${what} because ${who} is ${articleFor(rel)} ${rel} of ${obj}, and ${typeOf(check.object)} ${plural(check.relation)} inherit from parent ${typeOf(obj)} ${plural(rel)}.`;
}
