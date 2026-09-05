import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeaderCell, TableRow } from "./table";

describe("Table", () => {
  it("exposes table semantics and the column template", () => {
    render(
      <Table columns="1.5fr .8fr 40px" data-testid="t">
        <TableHead>
          <TableHeaderCell>Tenant</TableHeaderCell>
          <TableHeaderCell>Phase</TableHeaderCell>
          <TableHeaderCell />
        </TableHead>
        <TableBody>
          <TableRow active tint="bg-drift-tint">
            <TableCell mono>acme-air</TableCell>
            <TableCell>Degraded</TableCell>
            <TableCell>⋯</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>showing 1 of 42</TableFooter>
      </Table>,
    );
    const table = screen.getByRole("table");
    expect(table.style.getPropertyValue("--cols")).toBe("1.5fr .8fr 40px");
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
    const row = screen.getAllByRole("row")[1]!;
    expect(row.className).toContain("bg-card");
    expect(row.className).toContain("bg-drift-tint");
    expect(screen.getByRole("cell", { name: "acme-air" }).className).toContain("font-mono");
    expect(screen.getByText("showing 1 of 42")).toBeInTheDocument();
  });
});
