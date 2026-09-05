import { afterEach, describe, expect, it } from "vitest";
import { render, screen, userEvent } from "@/test/render";
import { ThemeSwitcher } from "./theme-switcher";

function cookieValue(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .map((pair) => pair.split("="))
    .find(([k]) => k === name)?.[1];
}

describe("ThemeSwitcher", () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
    document.cookie = "theme=; Path=/; Max-Age=0";
  });

  it("offers system, light and dark with the server's choice pressed", () => {
    render(<ThemeSwitcher initial="dark" />);
    const group = screen.getByRole("group", { name: "Theme" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "System" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
  });

  it("applies the choice to <html> and persists it in the theme cookie", async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher initial="system" />);

    await user.click(screen.getByRole("button", { name: "Light" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(cookieValue("theme")).toBe("light");
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "System" })).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "System" }));
    expect(document.documentElement.dataset.theme).toBe("system");
    expect(cookieValue("theme")).toBe("system");
  });

  it("explains the active option in words, not colour", async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher initial="system" />);
    expect(screen.getByText(/follows the operating system/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dark" }));
    expect(screen.getByText(/always dark/i)).toBeInTheDocument();
  });
});
