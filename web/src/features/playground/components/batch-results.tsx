import { Chip } from "@/components/ui/chip";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import type { BatchCheckResponse } from "@/features/playground/schemas";

/** Batch mode result: one row per submitted line, allowed / denied as a chip with its word. */
export function BatchResults({ result }: { result: BatchCheckResponse }) {
  const allowed = result.results.filter((r) => r.allowed).length;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <Eyebrow>Batch results</Eyebrow>
        <span className="font-mono text-[11px] text-fg-meta">
          {allowed} allowed · {result.results.length - allowed} denied · model v{result.modelVersion}
        </span>
      </div>
      <Table columns="1.2fr .8fr 1.4fr .6fr 90px" className="rounded-inner border border-line">
        <TableHead>
          <TableHeaderCell>user</TableHeaderCell>
          <TableHeaderCell>relation</TableHeaderCell>
          <TableHeaderCell>object</TableHeaderCell>
          <TableHeaderCell>ms</TableHeaderCell>
          <TableHeaderCell>result</TableHeaderCell>
        </TableHead>
        <TableBody>
          {result.results.map((r, i) => (
            <TableRow key={`${r.user}-${r.relation}-${r.object}-${i}`}>
              <TableCell mono>{r.user}</TableCell>
              <TableCell mono className="text-link">
                {r.relation}
              </TableCell>
              <TableCell mono>{r.object}</TableCell>
              <TableCell mono className="text-fg-meta">
                {r.durationMs}
              </TableCell>
              <TableCell>
                <Chip tone={r.allowed ? "ready" : "failed"}>{r.allowed ? "allowed" : "denied"}</Chip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
