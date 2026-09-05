import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/logo-mark";

export const metadata: Metadata = { title: "Sign in" };

const STATS = [
  { value: "38", label: "tenants converged", tone: "text-ready" },
  { value: "p95 21s", label: "convergence lag", tone: "text-fg" },
  { value: "p99 11ms", label: "check, cache hit", tone: "text-fg" },
] as const;

const ASSURANCES = [
  "Authorization Code + PKCE, state & nonce validated",
  "Encrypted HttpOnly SameSite=Lax session cookie",
  "Tokens exchanged server-side by route handlers",
] as const;

/**
 * Screen 01. Pure server component: the only interactive surface is the
 * sign-in link, which is a plain anchor to the BFF route handler so the
 * browser follows the redirect chain itself.
 */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const loginHref = next
    ? `/api/auth/login?next=${encodeURIComponent(next)}`
    : "/api/auth/login";

  return (
    <div className="flex h-dvh min-w-[1280px] bg-app text-fg">
      <section className="flex w-[640px] shrink-0 flex-col justify-between border-r border-line bg-[linear-gradient(180deg,#0A0E14,#0B1118)] px-14 py-16">
        <Wordmark size={30} />

        <div className="flex flex-col gap-6">
          <h2 className="text-[38px] font-semibold leading-[1.12] tracking-[-0.02em] text-fg">
            Declarative identity
            <br />
            and authorization,
            <br />
            continuously reconciled.
          </h2>
          <p className="max-w-[440px] text-[15px] leading-[1.6] text-fg-secondary">
            Submit desired state. The control plane converges Zitadel and
            OpenFGA toward it, detects drift, and records every decision.
          </p>
          <dl className="flex gap-7 pt-2">
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col gap-1">
                <dd className={`font-mono text-[22px] leading-none ${s.tone}`}>
                  {s.value}
                </dd>
                <dt className="text-[12px] text-fg-meta">{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>

        <footer className="font-mono text-[11px] leading-[1.7] text-fg-footnote">
          NOT PRODUCTION SOFTWARE · v0.1.0 · authz-plane.is-a.dev
        </footer>
      </section>

      <section className="flex flex-1 items-center justify-center p-12">
        <div className="flex w-[400px] flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-[24px] font-semibold tracking-[-0.01em] text-fg">
              Operator sign-in
            </h1>
            <p className="text-[14px] leading-[1.55] text-fg-tertiary">
              You will be redirected to Zitadel. The session is held
              server-side; no token ever reaches browser JavaScript.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <LinkButton href={loginHref} external variant="primary" size="lg">
              Continue with Zitadel
              <span aria-hidden className="font-mono text-[13px] opacity-70">
                ↗
              </span>
            </LinkButton>
            <LinkButton
              href="/login"
              variant="outline"
              size="lg"
              className="text-[14px] font-normal"
              aria-disabled
              tabIndex={-1}
              title="client_credentials for machine clients lands with the API's auth"
            >
              Machine client? Use the M2M token flow
            </LinkButton>
          </div>

          <hr className="border-0 border-t border-line" />

          <ul className="flex flex-col gap-2.5 font-mono text-[11.5px] leading-[1.6] text-fg-meta">
            {ASSURANCES.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden className="text-ready">
                  ✓
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
