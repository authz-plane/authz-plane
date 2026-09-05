import { Fragment } from "react";
import { cn } from "@/lib/cn";
import { groupThousands } from "@/lib/format";
import { diffDsl, newRelations, parseModel, type RelationDef } from "../dsl";

/** Type-name chips cycle through the phase palette so adjacent cards read apart. */
const TYPE_CHIP = ["bg-drift-chip text-drift", "bg-link-chip text-link", "bg-ready-chip text-ready", "bg-degraded-chip text-degraded"];

function Union() {
  return (
    <>
      <span aria-hidden className="text-fg-meta">
        ∪
      </span>
      <span className="sr-only">or</span>
    </>
  );
}

function RelationLine({ rel, isNew, draftVersion }: { rel: RelationDef; isNew: boolean; draftVersion: number }) {
  const parts: Array<{ text: string; tone: string }> = [];
  if (rel.direct.length > 0) {
    const onlyUsers = rel.direct.length === 1 && rel.direct[0] === "user";
    parts.push({ text: onlyUsers ? "direct" : `[${rel.direct.join(", ")}]`, tone: "text-fg-tertiary" });
  }
  for (const c of rel.computed) parts.push({ text: c, tone: "text-fg-tertiary" });
  for (const t of rel.tupleToUserset) parts.push({ text: `${t.relation} from ${t.via}`, tone: "text-degraded" });

  return (
    <li className="flex flex-wrap items-center gap-2 font-mono text-[12px]">
      <span className={isNew ? "text-ready" : "text-link"}>{rel.name}</span>
      <span aria-hidden className="text-fg-meta">
        ←
      </span>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <Union />}
          <span className={p.tone}>{p.text}</span>
        </Fragment>
      ))}
      {isNew && (
        <span className="rounded-[4px] bg-ready-tint px-1.5 py-px text-[10.5px] text-ready">new in v{draftVersion}</span>
      )}
    </li>
  );
}

/**
 * Right-hand "TYPE GRAPH" of frame 12: one card per type that declares
 * relations, each relation as `name ← direct ∪ computed ∪ x from parent`, plus
 * the compatibility footer.
 */
export function TypeGraph({
  live,
  draft,
  draftVersion,
  tupleCount,
}: {
  live: string;
  draft: string;
  draftVersion: number;
  tupleCount: number;
}) {
  const liveModel = parseModel(live);
  const draftModel = parseModel(draft);
  const fresh = newRelations(liveModel, draftModel);
  const { removed } = diffDsl(live, draft);
  const removedDefines = removed.filter((l) => l.startsWith("define "));
  const types = draftModel.types
    .filter((t) => t.relations.length > 0)
    .sort((a, b) => b.relations.length - a.relations.length);
  const subjectTypes = draftModel.types.filter((t) => t.relations.length === 0).map((t) => t.name);

  return (
    <>
      {types.map((type, i) => (
        <section key={type.name} className="flex flex-col gap-3 rounded-card border border-line bg-card p-4">
          <div className="flex items-center gap-2.5">
            <span className={cn("rounded-pill px-[9px] py-1 font-mono text-[12.5px]", TYPE_CHIP[i % TYPE_CHIP.length])}>
              {type.name}
            </span>
            <span className="font-mono text-[11px] text-fg-meta">
              {`${type.relations.length} relation${type.relations.length === 1 ? "" : "s"}`}
            </span>
          </div>
          <ul className="flex flex-col gap-2 border-l border-line-control pl-3">
            {[...type.relations].reverse().map((rel) => (
              <RelationLine
                key={rel.name}
                rel={rel}
                isNew={fresh.has(`${type.name}#${rel.name}`)}
                draftVersion={draftVersion}
              />
            ))}
          </ul>
        </section>
      ))}
      {subjectTypes.length > 0 && (
        <p className="font-mono text-[11px] text-fg-meta">
          subject types without relations: {subjectTypes.join(", ")}
        </p>
      )}
      <div className="flex gap-2.5 rounded-card border border-degraded-border bg-degraded-tint p-3.5">
        <span aria-hidden className="text-degraded">
          ⚠
        </span>
        <div className="flex flex-col gap-1">
          <span className="text-[12.5px] text-fg">Adding a relation is backward compatible; removing one is not</span>
          <span className="font-mono text-[11px] leading-[1.6] text-fg-meta">
            {groupThousands(tupleCount)} existing tuples validate against v{draftVersion}. Writing v{draftVersion} invalidates
            cached decisions for this tenant by model-version tag.
          </span>
          {removedDefines.length > 0 && (
            <span className="font-mono text-[11px] leading-[1.6] text-failed">
              − removes {removedDefines.length} relation{removedDefines.length === 1 ? "" : "s"} present in the live model
            </span>
          )}
        </div>
      </div>
    </>
  );
}
