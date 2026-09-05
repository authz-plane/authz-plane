import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/render";
import { RunFilters } from "./run-filters";

const router = { push: vi.fn(), replace: vi.fn() };

beforeEach(() => {
  vi.mocked(useRouter).mockReturnValue(router as unknown as ReturnType<typeof useRouter>);
  vi.mocked(usePathname).mockReturnValue("/reconcile-runs");
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("outcome=Failed&cursor=abc") as never);
});

describe("RunFilters", () => {
  it("writes the chosen trigger to the URL, keeps other filters and drops the cursor", async () => {
    render(<RunFilters filter={{ outcome: "Failed" }} tenantSlugs={["acme-air", "northwind-rail"]} />);

    const trigger = screen.getByRole("combobox", { name: "Filter by trigger" });
    expect(trigger).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Filter by outcome" })).toHaveValue("Failed");

    await userEvent.selectOptions(trigger, "backoff");
    expect(router.replace).toHaveBeenCalledWith("/reconcile-runs?outcome=Failed&trigger=backoff");
  });

  it("clears a filter back to any", async () => {
    render(<RunFilters filter={{ outcome: "Failed" }} tenantSlugs={["acme-air"]} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Filter by outcome" }), "");
    expect(router.replace).toHaveBeenCalledWith("/reconcile-runs");
  });

  it("hides the tenant pill on tenant-scoped pages", () => {
    render(<RunFilters filter={{}} tenantSlugs={[]} showTenant={false} />);
    expect(screen.getAllByRole("combobox").length).toBe(2);
    expect(screen.queryByRole("combobox", { name: "Filter by tenant" })).not.toBeInTheDocument();
  });
});
