<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Claquette project notes

Stack: Next.js 16 (App Router, Cache Components + Partial Prefetching), React 19, TypeScript, Tailwind v4,
Drizzle ORM 0.45 + postgres.js (PostgreSQL), Better Auth (username + password), Zod 4, Vitest.
UI copy is Turkish; code, identifiers and comments are English. Docs live in `docs/` (Turkish).

Commands: `npm run dev`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`,
`npm run db:generate` (after schema edits), `npm run db:migrate`.

Layout: `src/app` holds routing only; features live in `src/modules/<feature>/`:
`domain/` or `domain.ts` (pure, unit-tested), `service.ts` (writes), `queries.ts` (reads),
`actions.ts` (Server Actions), `components/`. Schema: `src/db/schema/*`, migrations: `drizzle/`.

Naming: a "challenge" in code is an "ortak liste" (shared list) in the UI; personal lists ("Listelerim")
are `lists` / `src/modules/lists`. Never write "etkinlik" in UI copy.

Rules that keep this codebase working:
- Every page renders its user-specific part inside `<Suspense>`; reading the session or the DB outside
  a boundary fails the Cache Components build.
- Authorize close to the data: pages and Server Actions call `requireUser()` and check membership via
  `getChallengeAccess` / `requireMembership`. The proxy is only an optimistic redirect.
- Server Actions return `ActionState`; throw `AppError` for user-facing failures, call `refresh()` after
  mutations, `redirect()` after creates.
- Routes stay mounted (hidden) via React `<Activity>`: use `useFieldId()` for label/input ids and wrap
  create forms in `FreshAfterSubmit`. In browser tests, filter locators with `{ visible: true }`.
- In `sql` templates, outer columns of correlated subqueries must use `qualified(column)` from `src/db/sql.ts`
  (Drizzle renders columns unqualified in single-table queries). Prefer grouped queries merged in code.
- New suggestion rules implement `ChallengeStrategy` (`src/modules/challenges/domain/strategies`) and are
  registered in `STRATEGIES`; new metadata sources implement `MediaProvider` (`src/modules/media/providers`)
  and get their attribution on the About page (`src/app/(app)/about/page.tsx`) and in the footer.
- The engine reasons about workflow state *categories* (pending/active/done/dropped), never state labels.
- Planning (`planning()` on a strategy, `domain/plan.ts`, `planning.ts`) may create future rounds early.
  Rounds must stay contiguous from index 0 (use `createRoundsThrough`), and the current round is found by
  date (`getCurrentRound`), never as "the latest row".
- Only `/lists/<uuid>` bypasses the proxy (public personal lists); such pages use `getCurrentUser()` and
  `canViewList`, and private lists must look exactly like missing ones.
- A page reused with different search params keeps its client state: key forms by those params (the URL's,
  not data derived from them, or a `refresh()` remounts the form and drops its action state).
- Forms that add media hold the picks with `useBasket` + `MediaPicker` and read them with `readMediaToAdd`;
  services add items one by one and return a `BatchResult`, so one failure doesn't block the rest.
- Adding to a shared list happens on its page (`?add=1`). Announce results with `toast()`; after a redirect,
  pass ids in the URL (`?added=`, `?removed=`), validate them on the page and render `FlashNotice`.
  Effects re-run when a hidden route is shown again: guard one-off side effects.
- Name media items with `formatTitle` / `MediaTitle` (`src/modules/media/titles.ts`): original first, Turkish in
  parentheses, season last ("Lost · 2. Sezon"). Select `...titleColumns` (`src/modules/media/columns.ts`) wherever
  a name is shown. A season of a series is its own catalog item (`season_number`, TMDB id `tv:<id>:s<n>`).
- Board notes (`board_notes`) are free text for people; the engine never reads them. Edits carry the version
  they started from and are refused if the note changed meanwhile.
- After signing in, navigate with a full load (`window.location`): links prefetched while signed out
  still hold the sign-in redirect in the client cache.
