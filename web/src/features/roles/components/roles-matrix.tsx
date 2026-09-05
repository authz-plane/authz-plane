import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { PERMISSIONS, type Role } from "./../schemas";

const GRID = "grid grid-cols-[1.6fr_repeat(5,1fr)] items-center";

function Dot({ granted }: { granted: boolean }) {
  return granted ? (
    <span aria-label="granted" className="text-ready">
      ●
    </span>
  ) : (
    // The frame's "not granted" ring sits between line-control and line-disabled; it has its own token.
    <span aria-label="not granted" className="text-not-granted">
      ○
    </span>
  );
}

function caption(role: Role): string {
  if (role.staged) return `staged in gen ${role.source.generation} · not applied`;
  if (role.unusedDays !== null) return `${role.users} users · unused ${role.unusedDays}d`;
  return `${role.users} users · from spec`;
}

/**
 * Frame 13 matrix: header row `1.6fr repeat(5,1fr)` with centred mono
 * permission columns; each row is a selectable grid row. Granted is a filled
 * dot, not granted a ring, both with aria-labels so state is never colour alone.
 */
export function RolesMatrix({
  roles,
  selectedKey,
  onSelect,
}: {
  roles: Role[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <Card role="grid" aria-label="Roles and permissions" className="flex flex-col overflow-hidden">
      <div
        role="row"
        className={cn(GRID, "border-b border-line px-4 py-3.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-meta")}
      >
        <span role="columnheader">role</span>
        {PERMISSIONS.map((p) => (
          <span key={p} role="columnheader" className="text-center normal-case">
            {p}
          </span>
        ))}
      </div>
      {roles.map((role, i) => {
        const selected = role.key === selectedKey;
        const dimmed = !role.staged && role.unusedDays !== null;
        return (
          <div
            key={role.key}
            role="row"
            tabIndex={0}
            aria-selected={selected}
            data-role={role.key}
            data-staged={role.staged || undefined}
            onClick={() => onSelect(role.key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(role.key);
              }
            }}
            className={cn(
              GRID,
              "cursor-pointer p-4 text-[15px] transition-colors duration-[120ms] hover:bg-hover",
              i < roles.length - 1 && "border-b border-line-row",
              role.staged && "bg-ready-tint",
              selected && "shadow-[inset_2px_0_0_var(--color-primary)]",
            )}
          >
            <div role="gridcell" className="flex flex-col gap-[3px]">
              <span
                className={cn(
                  "text-[13.5px] font-medium",
                  role.staged ? "text-ready" : dimmed ? "text-fg-meta" : "text-fg",
                )}
              >
                {role.key}
              </span>
              <span className="font-mono text-[11px] text-fg-meta">{caption(role)}</span>
            </div>
            {PERMISSIONS.map((p) => (
              <span key={p} role="gridcell" className="text-center">
                <Dot granted={role.permissions.includes(p)} />
              </span>
            ))}
          </div>
        );
      })}
    </Card>
  );
}
