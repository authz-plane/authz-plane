import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/render";
import { Button, LinkButton } from "./button";

describe("Button", () => {
  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveAttribute("type", "button");
  });

  it("applies variant and size classes", () => {
    render(
      <Button variant="primary" size="lg">
        Continue
      </Button>,
    );
    const b = screen.getByRole("button");
    expect(b.className).toContain("bg-primary");
    expect(b.className).toContain("h-12");
  });

  it("does not fire when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Nope
      </Button>,
    );
    await userEvent.click(screen.getByRole("button")).catch(() => undefined);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("LinkButton", () => {
  it("renders a Next link by default", () => {
    render(<LinkButton href="/tenants">Tenants</LinkButton>);
    expect(screen.getByRole("link", { name: "Tenants" })).toHaveAttribute("href", "/tenants");
  });

  it("renders a plain anchor for route handlers when external", () => {
    render(
      <LinkButton href="/api/auth/login" external variant="primary">
        Sign in
      </LinkButton>,
    );
    const a = screen.getByRole("link", { name: "Sign in" });
    expect(a).toHaveAttribute("href", "/api/auth/login");
    expect(a.className).toContain("bg-primary");
  });
});
