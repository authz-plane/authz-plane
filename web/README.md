# authz-plane console (`web/`)

Next.js 16 App Router console for the control plane. It is also the BFF: the
browser holds one encrypted, HttpOnly, SameSite=Lax session cookie and every
call to the .NET API goes through route handlers under `src/app/api/`, which
attach the bearer token server-side. No token is ever readable from browser JS.

Design source of truth: the handoff README in
`design_handoff_authz_plane_console`. Tokens in `src/app/globals.css` are
`light-dark()` pairs: the dark side is copied from the handoff verbatim, the
light side is derived (the handoff has no light theme). Add new tokens there
as pairs, never inline a hex.

Theme: `html[data-theme]` is `system | light | dark`, read from the `theme`
cookie by the root layout and switched client-side by `ThemeSwitcher`
(Settings → Appearance). `system` leaves `color-scheme: light dark` so the OS
decides; nothing else in the tree knows which theme is active.

All 20 handoff screens exist. Data is served from deterministic fixtures with
in-memory stores for mutations (they reset on restart) until AuthzPlane.Api
exposes endpoints; every data access goes through a feature's `server.ts`, so
swapping fixtures for API calls is a one-file change per feature.

## Run

```bash
cp .env.example .env.local   # AUTH_MODE=mock is the default
npm install
npm run dev
```

Open <http://localhost:3000>. Anonymous visitors land on `/login`; "Continue
with Zitadel" hits `/api/auth/login`, which in mock mode seals a session for a
synthetic operator and redirects to `/dashboard`.

## Check before you commit

```bash
npm run check   # eslint, next typegen + tsc --noEmit, vitest (node + jsdom projects)
npm run build
```

If `npm install` ever leaves vitest complaining about a missing rolldown
binding, that is the npm optional-dependency bug: remove `node_modules` and
`package-lock.json` and install again.

## Folder structure

```
src/
  app/                      routes only, kept thin
    login/                  screen 01
    (console)/              platform pages behind the platform sidebar
    (tenant)/tenants/[slug] tenant-scoped pages behind the tenant sidebar
    api/                    BFF route handlers: guardRoute -> feature server fn
  features/<feature>/       one folder per domain area
    schemas.ts              zod wire shapes + types (client-safe)
    fixtures.ts             deterministic data, "now" = 2026-09-04T10:15:00Z
    server.ts               `server-only`; called by pages and route handlers
    keys.ts                 TanStack Query keys per the handoff
    hooks.ts                useQuery / useMutation wrappers
    components/             feature components, "use client" only where needed
    *.test.ts(x)            colocated tests
  components/
    ui/                     primitives matching the tokens (no shadcn)
    layout/                 sidebars, topbar, page header, split body
    states/                 screen 20: empty, skeleton, terminal failure, forbidden
    providers/              QueryClient provider
  lib/                      cross-cutting: cn, format, phase tones, BFF client
  server/                   BFF-only: session crypto, operator, problem+json, guard
  test/                     vitest setup, render helper, server-only stub
```

Features: `dashboard`, `tenants`, `spec`, `reconcile`, `drift`, `audit`,
`authz-model`, `roles`, `relations`, `playground`, `identity-providers`, `users`.

## Screens and routes

| # | Screen | Route |
|---|---|---|
| 01 | Sign in | `/login` |
| 02 | Platform overview | `/dashboard` |
| 03 | Tenants list | `/tenants` |
| 04 | Tenant detail | `/tenants/[slug]` |
| 05 | Spec editor | `/tenants/[slug]/spec` |
| 06 | Spec history and diff | `/tenants/[slug]/spec/versions` |
| 07 | Plan preview modal | `?plan=1` on 04 and 05 |
| 08 | Reconcile runs | `/reconcile-runs`, `/tenants/[slug]/reconcile-runs` |
| 09 | Run detail | `/reconcile-runs/[runId]` |
| 10 | Drift findings | `/drift`, `/tenants/[slug]/drift` |
| 11 | Drift finding drawer | `/drift/[findingId]` |
| 12 | Authorization model | `/tenants/[slug]/authorization-model` |
| 13 | Roles and permissions | `/tenants/[slug]/roles` |
| 14 | Relations | `/tenants/[slug]/relations` |
| 15 | Permission playground | `/playground` |
| 16 | Identity providers | `/tenants/[slug]/identity-providers` |
| 17 | Audit | `/tenants/[slug]/audit-events`, `/audit` |
| 18 | Users | `/tenants/[slug]/users` |
| 19 | New tenant | `/tenants/new` |
| 20 | System states | `src/components/states`, used by every table |

Also `/authorization` (tenant picker) and `/settings` (session, console facts).

BFF routes live under `/api/` and mirror the system design's `/v1` surface:
tenants, spec (+validate, versions, restore), reconcile (+dryRun), reconcile-runs
(+retry), drift (+heal, acknowledge, resync), audit-events (+exports),
authorization-model (+validate), roles, relations (+write), explain,
batch-check, identity-providers (+test), users (+refresh, invite).

## Conventions

- Server components render the shell and fetch the first payload into a
  `QueryClient`; client components take over via `HydrationBoundary`.
- Polling: 2s while any tenant or run is in flight, 10s once settled, paused
  on tab blur. Run detail polls 1s until `finishedAt`.
- Filters and cursors live in the URL. Pages never sort or filter client-side.
- Every mutation goes through `bffMutate`, which adds an `Idempotency-Key`.
  Route handlers use `guardRoute` (session, Origin, key) and answer RFC 9457
  problem+json on failure.
- Base element styles in `globals.css` must sit inside `@layer base`. An
  unlayered rule wins over every Tailwind utility regardless of specificity.
- Never encode state in colour alone: chips carry their word, rows a glyph.
- Timestamps render in UTC with a `Z` suffix so SSR and the browser agree.
- Sign-in is mock-only (`AUTH_MODE=mock`). `AUTH_MODE=oidc` answers 501 until
  Zitadel is in docker-compose.
