# authz-plane — working notes for Claude Code

## Layout and rules
- Four projects under `src/`: Domain → Application → Infrastructure → Api. The
  dependency direction is enforced by `tests/AuthzPlane.Architecture.Tests`;
  do not add references that fight it. See `docs/adr/`.
- `TreatWarningsAsErrors` is on and `dotnet format --verify-no-changes` runs in
  CI. Run both before declaring anything done.
- Never read ambient time in `src/` outside `Infrastructure/Time/SystemClock.cs`;
  inject `IClock`. A test scans for it.
- Every `ITenantScoped` entity needs a query filter in
  `AuthzPlaneDbContext.ApplyTenantIsolation`, referencing `CurrentTenantId`
  (never the `ICurrentTenant` service inline). A test walks the model.
- EF migrations live in `Infrastructure/Persistence/Migrations`; after adding
  one, regenerate `docs/db/migrations.sql` (`dotnet tool run dotnet-ef migrations
  script --idempotent ...`) — CI diffs it.
- Package versions live only in `Directory.Packages.props` (central package
  management). Add packages with `dotnet add package`, never by hand.

## Local environment
- Postgres from `docker compose` is on host port **5433**; a native PostgreSQL
  service owns 5432 on this machine. Docker Desktop must be started manually.
- Solution file is `AuthzPlane.slnx`.
- Commits are signed (SSH key) with the GitHub noreply email, configured per
  repo. Do not change the global git identity — it is the user's work identity.

## Git
- Trunk is `dev`, protected: signed commits, linear history, no force push.
- **Do not push.** Prepare commits; the user pushes.

## UI (`web/`)
- Next.js 16 App Router, TypeScript strict, Tailwind 4, TanStack Query, Zod.
- Design spec: the handoff README in
  `C:\Users\raj.kolekar\Desktop\Greater Than\design_handoff_authz_plane_console`.
  Match its tokens exactly (IBM Plex Sans/Mono, surface colours, phase colours).
- BFF pattern: the browser never sees tokens. Data goes through route handlers
  under `src/app/api/`, which proxy to the .NET API (mock fixtures until the
  API has endpoints).
- Feature-based layout: `src/features/<feature>/{schemas,fixtures,server,keys,
  hooks,components,*.test}`; shared primitives in `src/components/{ui,layout,
  states}`; BFF-only code in `src/server`. Pages stay thin (parse params,
  call the feature `server.ts`, hydrate). See `web/README.md`.
- Run `npm run check` (eslint, typegen + tsc, vitest) and `npm run build` in
  `web/` before declaring UI work done.
- Base element styles in `globals.css` go inside `@layer base`; an unlayered
  rule beats every Tailwind utility. Tokens live only in `@theme` there.
- `not-found.tsx` for unmatched URLs must be at `src/app/`; a route-group copy
  only fires for explicit `notFound()` calls.
