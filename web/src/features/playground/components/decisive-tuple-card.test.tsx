import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { ACME_AIR_MODEL_V6, ACME_AIR_TUPLES, DEFAULT_QUERY } from "../fixtures";
import { explain } from "../resolver";
import { auditEventHref, DecisiveTupleCard, shortTupleId } from "./decisive-tuple-card";

const OPTS = { now: "2026-09-04T10:15:00Z", modelVersion: 6, consistency: "strong" as const };

describe("DecisiveTupleCard", () => {
  it("names the tuple, who wrote it, when, and links to its audit event", () => {
    const result = explain(ACME_AIR_MODEL_V6, ACME_AIR_TUPLES, DEFAULT_QUERY, OPTS);
    render(<DecisiveTupleCard slug="acme-air" result={result} />);
    const card = screen.getByRole("region", { name: "Decisive tuple" });
    expect(card.className).toContain("bg-ready-tint-deep");
    expect(screen.getByText("Allowed because of one tuple")).toBeInTheDocument();
    expect(screen.getByText(result.reason)).toBeInTheDocument();
    expect(screen.getByText("tupleId")).toBeInTheDocument();
    expect(screen.getByTitle("a3f1d2e4b6c9")).toHaveTextContent("a3f1…c9");
    expect(screen.getByText("writtenBy")).toBeInTheDocument();
    expect(screen.getByText("admin@acme.test")).toBeInTheDocument();
    expect(screen.getByText("2026-08-30T09:00:00Z")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "open audit event ↗" })).toHaveAttribute(
      "href",
      "/tenants/acme-air/audit-events?event=evt_tuple_a3f1",
    );
  });

  it("renders the denied variant with the reason and no provenance", () => {
    const result = explain(ACME_AIR_MODEL_V6, ACME_AIR_TUPLES, { ...DEFAULT_QUERY, user: "user:nobody" }, OPTS);
    render(<DecisiveTupleCard slug="acme-air" result={result} />);
    expect(screen.getByRole("region", { name: "Decision" })).toHaveTextContent("Denied · no tuple grants this");
    expect(screen.queryByText("writtenBy")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shortens tuple ids and builds audit hrefs", () => {
    expect(shortTupleId("a3f1d2e4b6c9")).toBe("a3f1…c9");
    expect(shortTupleId("abcd1234")).toBe("abcd1234");
    expect(auditEventHref("acme-air", "evt tuple")).toBe("/tenants/acme-air/audit-events?event=evt%20tuple");
  });
});
