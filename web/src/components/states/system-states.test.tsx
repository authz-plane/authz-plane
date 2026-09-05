import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/render";
import { EmptyState, Forbidden, ProblemNotice, TableSkeleton, TerminalFailure } from "./system-states";

describe("system states (screen 20)", () => {
  it("EmptyState shows eyebrow, title, explainer and actions", () => {
    render(
      <EmptyState eyebrow="Empty · no tenants yet" title="No tenants yet" actions={<button type="button">New tenant</button>}>
        Run <code>make seed</code>.
      </EmptyState>,
    );
    expect(screen.getByText("Empty · no tenants yet")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No tenants yet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New tenant" })).toBeInTheDocument();
  });

  it("TableSkeleton is announced as busy and contains no spinner", () => {
    const { container } = render(<TableSkeleton rows={3} columns={4} />);
    expect(screen.getByLabelText("Loading")).toHaveAttribute("aria-busy", "true");
    expect(container.querySelectorAll(".skeleton")).toHaveLength(12);
    expect(container.querySelector("[role=progressbar]")).toBeNull();
  });

  it("TerminalFailure is an alert with the error well and a human-readable note", () => {
    render(
      <TerminalFailure
        title="northwind-rail is Failed"
        summary="8 of 8 attempts exhausted over 24m."
        errorLines={["400 invalid_idp_config"]}
        actions={<button type="button">Fix spec &amp; reconcile</button>}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("northwind-rail is Failed");
    expect(screen.getByText("400 invalid_idp_config")).toBeInTheDocument();
    expect(screen.getByText(/terminal by design/)).toBeInTheDocument();
  });

  it("Forbidden names the session tenant and the denied check, never the other tenant", () => {
    render(<Forbidden sessionTenant="acme-air" deniedCheck='check(user, "viewer", "tenant:…")' requestId="req_7f3a" />);
    expect(screen.getByText("acme-air")).toBeInTheDocument();
    expect(screen.getByText(/this attempt was audited/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to my tenants" })).toHaveAttribute("href", "/tenants");
  });

  it("ProblemNotice renders title + detail and offers Retry when given", async () => {
    const onRetry = vi.fn();
    render(<ProblemNotice title="Upstream unavailable" detail="OpenFGA 503" onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Upstream unavailable");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
  });
});
