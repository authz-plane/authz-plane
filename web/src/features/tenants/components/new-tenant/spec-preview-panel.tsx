import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";
import { specPreviewLines, type SpecLine, type SpecPreviewInput } from "../../spec-preview";

const TONE: Record<NonNullable<SpecLine["tone"]>, string> = {
  plain: "",
  bool: "text-drift",
  number: "text-accent",
};

// "    - key: tenant_admin" -> colour the key the way the frame does for list items.
const RAW_KEY = /^(\s*(?:- )?)([A-Za-z_][\w-]*:)(.*)$/;

function Line({ line }: { line: SpecLine }) {
  if (line.raw !== undefined) {
    const m = RAW_KEY.exec(line.raw);
    return (
      <div className="whitespace-pre">
        {m ? (
          <>
            {m[1]}
            <span className="text-fg-tertiary">{m[2]}</span>
            {m[3]}
          </>
        ) : (
          line.raw || " "
        )}
      </div>
    );
  }
  return (
    <div className="whitespace-pre" style={line.indent ? { paddingLeft: `${line.indent * 1.24}em` } : undefined}>
      <span className="text-fg-tertiary">{line.key}:</span>
      {line.value !== undefined && (
        <>
          {" "}
          <span className={cn(TONE[line.tone ?? "plain"])}>{line.value}</span>
        </>
      )}
    </div>
  );
}

/**
 * Right 400px panel of frame 19: eyebrow, the live generation-1 YAML well
 * (12px mono, line-height 1.95) and the reconciler info card.
 */
export function SpecPreviewPanel({ input }: { input: SpecPreviewInput }) {
  const lines = specPreviewLines(input);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5 p-6">
      <Eyebrow>Spec preview · generation 1</Eyebrow>
      <div
        aria-label="Spec preview"
        className="min-h-0 flex-1 overflow-auto rounded-inner border border-line bg-inset p-3.5 font-mono text-[12px] leading-[1.95] text-fg-code"
      >
        {lines.map((line, i) => (
          <Line key={i} line={line} />
        ))}
      </div>
      <div className="flex gap-[9px] rounded-inner border border-line p-[13px]">
        <span aria-hidden className="text-link">
          ⓘ
        </span>
        <p className="text-[12px] leading-[1.55] text-fg-secondary">
          Creating the tenant writes generation 1 and enqueues the first reconcile. The Zitadel org is created by the
          reconciler, not by this form.
        </p>
      </div>
    </div>
  );
}
