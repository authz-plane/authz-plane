import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { DiffBlock } from "./diff";

describe("DiffBlock", () => {
  it("labels every non-context line with its glyph so colour is never alone", () => {
    render(
      <DiffBlock
        gutter
        lines={[
          { kind: "context", text: "roles:", n: 12 },
          { kind: "removed", text: "  - tenant_legacy_ops", n: 13 },
          { kind: "added", text: "  - tenant_auditor", n: 13 },
          { kind: "changed", text: "resync: 600", n: 14 },
        ]}
      />,
    );
    expect(screen.getByLabelText("removed")).toHaveTextContent("−");
    expect(screen.getByLabelText("added")).toHaveTextContent("+");
    expect(screen.getByLabelText("changed")).toHaveTextContent("~");
    expect(screen.getByText("roles:").parentElement?.className).toContain("text-fg-meta");
    expect(screen.getAllByText("13")).toHaveLength(2);
  });

  it("keeps whitespace with white-space: pre on each line", () => {
    render(<DiffBlock lines={[{ kind: "added", text: "    indented" }]} />);
    expect(screen.getByText("indented", { exact: false }).parentElement?.className).toContain("whitespace-pre");
  });
});
