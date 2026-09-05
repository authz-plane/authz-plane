import Link from "next/link";
import { Chip } from "@/components/ui/chip";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { initialsFor } from "../fixtures";
import type { UserRecord, UserRole } from "../schemas";

export const USERS_COLUMNS = "1.6fr 1.2fr 1fr 1fr .8fr";

/** Avatar tint follows the row's story: drift for unmanaged/staged, link for admins, neutral otherwise. */
function avatarClasses(u: UserRecord): string {
  if (u.state === "unmanaged") return "bg-drift-chip text-drift";
  if (u.roles.some((r) => r.state === "staged" || r.state === "drift")) return "bg-drift-chip text-drift";
  if (u.roles.some((r) => r.name === "tenant_admin")) return "bg-link-chip text-link";
  return "bg-line-control text-fg-secondary";
}

function RoleLabel({ role }: { role: UserRole }) {
  switch (role.state) {
    case "staged":
      return (
        <span className="text-ready" title="staged in the next generation, not yet applied">
          {role.name}
          <span aria-hidden>*</span>
          <span className="sr-only"> (staged)</span>
        </span>
      );
    case "drift":
      return <span className="text-drift">{role.name} (drift)</span>;
    default:
      return <span className="text-fg">{role.name}</span>;
  }
}

/**
 * Frame 18 table: USER (28px initials avatar, name, mono email), SUBJECT,
 * ROLES (staged marked with *, drift in the drift tone), TUPLES (count, or a
 * pending delete in the failed tone), STATE chip. Unmanaged rows caption
 * "not in desired state" under the address.
 */
export function UsersTable({ slug, items }: { slug: string; items: UserRecord[] }) {
  return (
    <Table columns={USERS_COLUMNS} aria-label="Users">
      <TableHead className="px-3">
        <TableHeaderCell>user</TableHeaderCell>
        <TableHeaderCell>subject</TableHeaderCell>
        <TableHeaderCell>roles</TableHeaderCell>
        <TableHeaderCell>tuples</TableHeaderCell>
        <TableHeaderCell>state</TableHeaderCell>
      </TableHead>
      <TableBody>
        {items.map((u) => {
          const unmanaged = u.state === "unmanaged";
          return (
            <TableRow key={u.id} className="px-3 py-3.5" aria-label={u.subject}>
              <TableCell className="flex items-center gap-[11px] overflow-visible">
                <span
                  aria-hidden
                  className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-[11px]", avatarClasses(u))}
                >
                  {initialsFor(u)}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className={cn("truncate text-[13px]", u.name ? "text-fg" : "text-fg-secondary")}>{u.name ?? u.email}</span>
                  {unmanaged ? (
                    <span className="truncate font-mono text-[11px] text-drift">not in desired state</span>
                  ) : (
                    <span className="truncate font-mono text-[11px] text-fg-meta">{u.email}</span>
                  )}
                </span>
              </TableCell>
              <TableCell mono className="text-[12px] text-fg-secondary">
                {u.subject}
              </TableCell>
              <TableCell mono className="text-[12px]">
                {u.roles.length === 0 ? (
                  <span className="text-fg-meta">—</span>
                ) : (
                  u.roles.map((r, i) => (
                    <span key={r.name}>
                      {i > 0 && <span className="text-fg-meta">, </span>}
                      <RoleLabel role={r} />
                    </span>
                  ))
                )}
              </TableCell>
              <TableCell mono className="text-[12px]">
                {u.pendingDeletes > 0 ? (
                  <span className="text-failed">
                    {u.pendingDeletes} pending delete{u.pendingDeletes === 1 ? "" : "s"}
                  </span>
                ) : (
                  <Link
                    href={`/tenants/${encodeURIComponent(slug)}/relations?user=${encodeURIComponent(u.subject)}`}
                    className={unmanaged ? "text-drift" : "text-link"}
                    aria-label={`${u.tupleCount} tuples for ${u.subject}`}
                  >
                    {u.tupleCount}
                  </Link>
                )}
              </TableCell>
              <TableCell>
                <Chip tone={unmanaged ? "drift" : "ready"} className="text-[11px]">
                  {u.state}
                </Chip>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
