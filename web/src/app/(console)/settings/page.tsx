import type { Metadata } from "next";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { FactList } from "@/components/ui/well";
import { FAST_POLL_MS, SLOW_POLL_MS } from "@/features/dashboard/polling";
import { IN_FLIGHT_PHASES } from "@/lib/phase";
import { requireOperator } from "@/server/auth/operator";
import { currentTheme } from "@/server/theme";

export const metadata: Metadata = { title: "Settings" };

const CONSOLE_VERSION = "v0.1.0";

function utcStamp(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString().replace(".000Z", "Z");
}

/**
 * Operator-facing facts about this console: who is signed in, how the BFF is
 * configured, and the live-state polling rule. The only editable thing is the
 * appearance preference, which lives in a browser cookie; everything else
 * comes from the environment.
 */
export default async function SettingsPage() {
  const [operator, theme] = await Promise.all([requireOperator(), currentTheme()]);
  const authMode = process.env.AUTH_MODE?.trim() || "mock";
  const apiBase = process.env.AUTHZPLANE_API_URL?.trim();

  return (
    <>
      <Topbar title="Settings" meta={`console ${CONSOLE_VERSION} · auth ${authMode}`} />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-7 py-6">
        <div className="grid grid-cols-3 gap-3.5">
          <Card className="flex flex-col gap-3.5 p-[18px]">
            <Eyebrow>Session</Eyebrow>
            <CardTitle>{operator.name}</CardTitle>
            <FactList
              labelWidth={84}
              items={[
                { label: "subject", value: operator.sub },
                { label: "email", value: operator.email },
                { label: "role", value: operator.role },
                { label: "issued", value: utcStamp(operator.iat) },
                { label: "expires", value: utcStamp(operator.exp) },
                { label: "cookie", value: "HttpOnly · SameSite=Lax · AES-256-GCM" },
              ]}
            />
            <form action="/api/auth/logout" method="post" className="mt-auto pt-1">
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </Card>

          <Card className="flex flex-col gap-3.5 p-[18px]">
            <Eyebrow>Console</Eyebrow>
            <CardTitle>authz-plane console {CONSOLE_VERSION}</CardTitle>
            <FactList
              labelWidth={84}
              items={[
                { label: "AUTH_MODE", value: authMode, tone: authMode === "mock" ? "text-degraded" : "text-ready" },
                {
                  label: "data",
                  value: apiBase ? `AuthzPlane.Api · ${apiBase}` : "fixtures · AUTHZPLANE_API_URL unset",
                  tone: apiBase ? "text-ready" : "text-degraded",
                },
                { label: "pattern", value: "BFF · tokens never reach the browser" },
                { label: "mutations", value: "Idempotency-Key + Origin check" },
                { label: "errors", value: "RFC 9457 problem+json" },
              ]}
            />
            <p className="mt-auto text-[12px] leading-[1.5] text-fg-meta">
              Configuration is read from the environment at start; see <code className="font-mono">.env.example</code>.
            </p>
          </Card>

          <Card className="flex flex-col gap-3.5 p-[18px]">
            <Eyebrow>Polling</Eyebrow>
            <CardTitle>Live state</CardTitle>
            <FactList
              labelWidth={84}
              items={[
                { label: "in flight", value: `${FAST_POLL_MS / 1000}s`, tone: "text-link" },
                { label: "settled", value: `${SLOW_POLL_MS / 1000}s` },
                { label: "phases", value: IN_FLIGHT_PHASES.join(" · ") },
                { label: "tab blur", value: "paused" },
                { label: "screens", value: "overview · tenants · tenant · runs · run" },
              ]}
            />
            <p className="mt-auto text-[12px] leading-[1.5] text-fg-meta">
              While any tenant is {IN_FLIGHT_PHASES.join(", ")} the console refetches every {FAST_POLL_MS / 1000}s;
              once everything has settled it backs off to {SLOW_POLL_MS / 1000}s.
            </p>
          </Card>

          <Card className="flex flex-col gap-3.5 p-[18px]">
            <Eyebrow>Appearance</Eyebrow>
            <CardTitle>Theme</CardTitle>
            <ThemeSwitcher initial={theme} />
            <p className="mt-auto text-[12px] leading-[1.5] text-fg-meta">
              Applies immediately and is remembered by this browser in a <code className="font-mono">theme</code> cookie.
              System re-reads the operating system whenever it changes.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
