# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Online appointment booking for a small PH dental clinic. Full requirements, data model, and the phase-by-phase build plan live in `SPEC.md` — read it before making architectural decisions, it is the source of truth, not this file.

**Status: Phases 1–5 — all of SPEC.md's phases are built.** Scaffold, DB schema, migrations, seed script, the pure slot-generation engine (`src/lib/slots.ts` + `src/lib/timezone.ts`), the public booking flow end-to-end (services list, date/slot picker, booking form, cancel form, Server Actions in `src/lib/actions.ts`, Zod validation in `src/lib/validation.ts`), the admin auth + dashboard (`/admin/*` — iron-session login, appointment list/week view with status transitions, blocked-time management, services CRUD, weekly clinic-hours editor; see "Admin auth + dashboard" below), and notifications + reminders (`src/lib/notifications/`, the `/api/cron/reminders` route; see "Notifications + cron reminders" below) all exist, with a Vitest unit suite, one integration test (`src/lib/booking-repo.integration.test.ts`) that fires two concurrent bookings for the same slot against a real test database and asserts the exclusion constraint stops the second, and one Playwright E2E spec (`e2e/booking-happy-path.spec.ts`) covering the public booking-then-cancel happy path. Don't assume more than this exists — check before referencing it.

**Known gap, deliberately deferred:** the DB read/write functions in `src/lib/booking-queries.ts` (`getActiveServices`, `getServiceById`, `getClinicSettings`, `fetchBlockersInRange`, `getAvailableDatesForService`), `src/lib/booking-repo.ts`'s `cancelAppointmentByRefAndMobile`, and all of `src/lib/admin-queries.ts`/`src/lib/admin-repo.ts` have **zero automated test coverage** (only the pure logic they call into — `generateAvailableSlots`, the status-transition guard — is tested). This was surfaced in a full-repo best-practices audit and explicitly deferred to a future session rather than silently left unaddressed; a good next step is integration tests in the style of `booking-repo.integration.test.ts`.

## Commands

```bash
npm run dev                # dev server (Turbopack)
npm run build               # production build (Turbopack)
npm run lint                # eslint
npm run test                # vitest run, excluding *.integration.test.ts — single pass, use this for CI/"did it work" checks
npm run test:watch          # vitest — interactive watch mode for local dev, same integration-test exclusion
npm run test:integration    # vitest run src/lib/booking-repo.integration.test.ts — needs DATABASE_URL_TEST migrated (npm run db:migrate:test)
npm run test:e2e            # playwright test — one happy-path spec, runs against the regular dev DATABASE_URL (see README)
npm run test:e2e:ui         # playwright test --ui — interactive mode for debugging selectors

npm run db:generate          # drizzle-kit generate — diff src/db/schema.ts into a new migration
npm run db:migrate           # drizzle-kit migrate — apply pending migrations in drizzle/
npm run db:migrate:test      # drizzle-kit migrate --config=drizzle.config.test.ts — applies the same migrations to DATABASE_URL_TEST
npm run db:seed              # tsx src/db/seed.ts — wipe and reseed clinic settings/services/appointments
npm run db:studio            # drizzle-kit studio

npm run auth:hash -- <password>   # tsx src/lib/generate-password-hash.ts — prints an ADMIN_PASSWORD_HASH value for .env.local
```

Vitest config (`vitest.config.ts`) scopes `test.include` to `src/**/*.test.ts` — deliberately narrower than Vitest's default glob, which also matches `*.spec.ts`, so Playwright's specs (which live under a top-level `e2e/` folder using `*.spec.ts` naming, both outside `src/` and a different extension) can never collide with it. It also aliases `@` to `./src` (mirroring `tsconfig.json`'s path) since Vitest doesn't read tsconfig paths on its own — needed once `src/lib/booking-repo.ts` and friends started using `@/db/schema`-style imports. The `test`/`test:watch` scripts pass `--exclude "**/*.integration.test.ts"` so the fast/CI path never needs `DATABASE_URL_TEST` connectivity; `test:integration` targets that file explicitly and bypasses the exclude. `e2e/` and `playwright.config.ts` are also excluded from `tsconfig.json`'s program and `eslint.config.mjs`'s lint targets (`"e2e"` in `exclude`/`"e2e/**"` in `ignores`) — `tsconfig.json`'s `include` is an unscoped `**/*.ts`, and Next's build-time typecheck isn't scoped to only bundled files, so a broken/WIP Playwright spec could otherwise fail a production `next build` for reasons unrelated to app code.

**`drizzle-orm`'s `neon-http` driver never throws a `NeonDbError` directly** — it always wraps driver errors in a `DrizzleQueryError`, with the real error (SQLSTATE `code` and all) on `.cause`. `src/lib/booking-repo.ts`'s `asNeonDbError` helper unwraps this; a bare `err instanceof NeonDbError` check will never match and was the actual bug the concurrent-booking integration test caught the first time it ran against a real database.

Package manager is **npm** (`package-lock.json`) — don't introduce pnpm/yarn lockfiles or commands. The project started on pnpm during initial scaffolding and was switched to npm early in Phase 1; if you see any stray `pnpm-lock.yaml` or `pnpm-workspace.yaml`, they're leftovers to delete, not the source of truth. npm's newer install-script approval gate means new native deps (like a future db driver with prebuilt binaries) may need `npm approve-scripts --all` after `npm install` before they'll build.

## Tech stack

Fixed by `SPEC.md`; treat any deviation as something to flag, not decide unilaterally:

- Next.js 15 (App Router, Server Actions), TypeScript strict mode
- Tailwind CSS + shadcn/ui — initialized on **Radix** primitives (`radix-ui` package), not the newer Base UI preset shadcn's CLI defaults to. If you re-run `shadcn init`, pass `-b radix` or it will silently switch the primitive library and require reinstalling every component.
- Drizzle ORM + Postgres (Neon), using the `drizzle-orm/neon-http` driver (`@neondatabase/serverless`) — this is the serverless/edge-compatible driver, not `node-postgres`.
- Zod for validation, schemas shared between client and server — a single `src/lib/validation.ts` file per the file-organization convention below (booking and admin schemas both live there).
- Admin auth: iron-session + env-var credentials (`ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`), no auth framework — see "Admin auth + dashboard" below.
- date-fns + date-fns-tz for all Asia/Manila conversions — built in `src/lib/timezone.ts` (Phase 2). `src/db/seed.ts` still uses its own manual UTC+8 arithmetic and was deliberately left as-is (it predates this and rewriting a seed script wasn't in scope for Phase 2) — new code elsewhere should use `timezone.ts`, not replicate the manual offset math.
- Email: Resend if `RESEND_API_KEY` is set, else a console-logging fallback (Phase 5, not built).
- Vitest (unit/integration) — installed, pinned to the 3.x line (`^3.2.7`) rather than latest (4.x) specifically because 4.x declares `vite` as a required peer dependency and this project has no other use for Vite (Next.js uses Turbopack); 3.x has no such peer. Playwright (E2E) — not installed yet (Phase 5).
- Deploy target: Vercel + Neon free tier, Vercel Cron for the reminder job.

## Conventions

**File organization:** one flat file per concern, not a folder — e.g. `src/db/schema.ts` holds all four tables rather than a `schema/` directory per table. Only split a file into a folder once it exceeds roughly 300 lines. This applies project-wide (Zod schemas, notification adapters that are genuinely one interface with multiple implementations are the exception — those are separate concerns, not a split-for-size).

**Timezone handling:** Asia/Manila has a fixed UTC+8 offset year-round (no DST). All `timestamptz` columns store UTC; the app must always convert explicitly to/from Manila time at the boundaries (display, slot generation, lead-time checks). `src/lib/timezone.ts` is the canonical helper — `manilaDateTimeToUtc`, `utcToManilaDateString`, `utcToManilaTimeString`, `manilaWeekday`, `manilaCalendarDaysBetween`. Two subtleties worth knowing before touching this file (verified directly against `date-fns-tz@3.2.0`'s source, not assumed): `fromZonedTime` only takes the "interpret as local time in `timeZone`" branch when given a plain string with no trailing `Z`/offset, so `manilaDateTimeToUtc` must build a bare `` `${date}T${time}:00` `` string, never a pre-constructed `Date`; and `toZonedTime`'s result must be read back with **local** getters (`getFullYear`, `getHours`, ...), never `getUTC*` — it deliberately writes the target zone's wall-clock fields into the local fields of a throwaway `Date`, so `getUTC*` would silently return the wrong value regardless of the host machine's own timezone. `src/db/seed.ts` predates this file and still uses plain `Date.UTC(...)` arithmetic (`hour - 8`) — left as-is deliberately (rewriting the seed script wasn't in scope), but new code should use `timezone.ts`, not replicate that manual offset math.

**The exclusion constraint is sacred.** Double-booking is prevented at the database level by a Postgres `EXCLUDE USING gist` constraint on `appointments` (see `drizzle/0001_btree_gist_exclusion_constraint.sql`). This constraint — and the `CREATE EXTENSION btree_gist` it depends on — is **hand-written SQL**, generated via `drizzle-kit generate --custom --name=<...>`, never via a plain `drizzle-kit generate` diffed from `src/db/schema.ts`. Drizzle's schema file only owns the appointments table's columns; it has no representation of the exclusion constraint at all, so a future `generate` can't touch it. When adding new migrations that touch `appointments`, generate them normally and verify the constraint isn't dropped or altered.

**Standalone scripts vs. the Next.js runtime:** `src/db/client.ts` reads `process.env.DATABASE_URL` at module load and throws if unset — this works inside Next.js because it auto-loads `.env.local`, but scripts run via `tsx` (like `seed.ts`) need it loaded manually first. `src/db/load-env.ts` does that as a side-effect import and must be the *first* import in any standalone script that touches `./client`, because ES module imports are hoisted above other statements — importing `load-env` after `client` would run too late.

**dotenv prints an unsolicited promotional "tip" line** to stdout on every load (see `node_modules/dotenv/lib/main.js`'s `TIPS` array) unless `quiet: true` is passed. Always pass it: `config({ path: ".env.local", quiet: true })`.

## Data model

Four tables in `src/db/schema.ts`, matching `SPEC.md`'s sketch: `services`, `appointments` (with an `appointment_status` enum: `pending | confirmed | completed | cancelled | no_show`, and a btree index on `starts_at`), `blocked_times`, and `clinic_settings` (single-row, enforced with a `CHECK (id = 1)` constraint — always read/write the row where `id = 1`).

`clinic_settings.open_hours` is a `jsonb` column keyed by lowercase 3-letter weekday (`mon`...`sun`), each either `{ open: "HH:MM", close: "HH:MM" }` or `null` for closed. See `src/db/seed.ts` for the shape in use, and `src/lib/slots.ts`'s `OpenHours`/`OpenHoursDay` types for the canonical TypeScript shape (schema.ts itself still leaves the column untyped `jsonb` — Drizzle has no way to attach a TS type to a jsonb column's contents, so callers reading `clinicSettings.openHours` need to assert/cast it to `OpenHours`).

Booking reference codes (`appointments.ref_code`) are generated by `src/lib/ref-code.ts`, format `DNT-XXXXXX` using an alphabet that excludes `0/O` and `1/I` to stay unambiguous when read aloud over the phone — not a UUID, since patients read these back to cancel a booking.

## Slot-generation engine

`src/lib/slots.ts`'s `generateAvailableSlots` is the core booking-availability logic and the riskiest code in the app per `SPEC.md`. It's a **pure function** — no DB import, no internal `Date.now()`/`new Date()` — everything (including "now") is passed in by the caller, which is what makes it fully unit-testable (`src/lib/slots.test.ts`, 18 tests covering overlaps, blocked times, lead-time/max-advance boundaries, day boundaries, and multi-slot durations). One call computes slots for a single Manila calendar date; aggregating "which of the next 30 days have any availability" for the date-picker is Phase 3's job, calling this once per date — not built here.

Two things to know before modifying it:

- **Overlap checks (`rangesOverlap`) use the exact half-open range semantics as the DB's exclusion constraint** — `[s1,e1)` and `[s2,e2)` overlap iff `s1 < e2 && s2 < e1`, so two events that merely touch at a boundary (one ends exactly when another starts) do **not** overlap. This must stay in sync with `drizzle/0001_btree_gist_exclusion_constraint.sql`'s `tstzrange(...) WITH &&` — if the two ever disagree, the app would reject slots the DB would accept, or vice versa.
- **Overlap checks use the candidate's exact duration, never rounded up to a slot multiple.** SPEC's "occupies ceil(duration/30) consecutive slots" describes *why* a multi-slot appointment can block a later slot-start, not a literal instruction to round the blocking window — rounding would cause false rejections whenever a conflicting block/appointment isn't itself slot-aligned (see the non-slot-aligned-block test case in `slots.test.ts`, which is written specifically to catch a rounded-duration regression).

Other resolved ambiguities worth knowing: max-advance-days is **inclusive** (a date exactly `maxAdvanceDays` out is bookable); appointment-status filtering (only `pending`/`confirmed` block availability) happens *inside* `generateAvailableSlots`, not left to the caller's DB query.

## Admin auth + dashboard

Single admin, no user accounts. `middleware.ts` (matcher `/admin/:path*`) is the primary gate — it unseals the iron-session cookie via `getIronSession(request, response, sessionOptions)` and redirects to `/admin/login` if not logged in. `src/app/admin/(protected)/layout.tsx` re-checks and redirects too (defense-in-depth — middleware also protects any future Route Handlers, which a layout-only check never would) and renders the nav/logout chrome. The `(protected)` route group is required, not cosmetic: a single top-level `admin/layout.tsx` doing the redirect would also wrap `admin/login/page.tsx`, causing a redirect loop.

`src/lib/session.ts` deliberately has no `next/headers` import (must stay Edge Runtime-safe so `middleware.ts` can import it); `src/lib/get-session.ts` (which does import `next/headers`) is Server Component/Action/Route Handler-only. Passwords are hashed with Node's built-in `scryptSync`/`timingSafeEqual` (`src/lib/password.ts`) — zero new dependency; run `npm run auth:hash -- <password>` to generate the `ADMIN_PASSWORD_HASH` value for `.env.local`. `SESSION_SECRET` (iron-session's cookie-sealing key, ≥32 chars, enforced by the library at runtime) is a separate env var from `ADMIN_PASSWORD_HASH` — don't confuse the two.

The data layer mirrors the public booking split by read vs. write, not by entity: `src/lib/admin-queries.ts` (reads — `getAppointmentsInRange` with an optional status filter, `getAllBlockedTimes`, `getAllServices` including inactive rows) and `src/lib/admin-repo.ts` (writes, plus the pure `validAppointmentTransitions`/`canTransitionAppointmentStatus` guard, unit-tested in `admin-repo.test.ts`). Status-transition rule: from `pending`/`confirmed`, an admin can jump directly to any of `confirmed`/`completed`/`cancelled`/`no_show` — no forced staging through `confirmed` first; terminal statuses have zero valid transitions. `src/lib/admin-actions.ts` holds every admin Server Action. Blocked-time creation *warns*, it doesn't hard-block, on overlap with an existing pending/confirmed appointment, via a two-step confirm-anyway round trip mirroring the public booking flow's `slot_taken` pattern. None of these writes need `asNeonDbError`: `services`/`blocked_times` have no exclusion or uniqueness constraint an admin write could trip, and a `pending`↔`confirmed` status UPDATE can never trigger the appointments exclusion constraint since both statuses are already inside its `WHERE` predicate.

`formDataToObject` (FormData → `Record<string,string>`) lives in `src/lib/form-data.ts`, not in `actions.ts` — a file with a top-level `"use server"` directive can only export async Server Actions, so a shared plain helper has to live outside it; `actions.ts`, `auth-actions.ts`, and `admin-actions.ts` all import it from there.

## Notifications + cron reminders

`src/lib/notifications/` is the one place in this codebase that's a folder instead of a flat file — CLAUDE.md's own file-organization rule explicitly carves out this exact case ("notification adapters that are genuinely one interface with multiple implementations are the exception"). `notification-service.ts` holds the `NotificationService` interface (`sendBookingReceived`/`sendConfirmed`/`sendReminder`/`sendCancelled`) and a shared `NotificationPayload` type; `email-adapter.ts` (Resend) and `console-adapter.ts` are the two live implementations, `sms-adapter.ts` is a typed stub (not wired into anything — PH SMS providers are a future addition). `index.ts` picks `EmailAdapter` if `RESEND_API_KEY` is set, else `ConsoleAdapter` (module-load branch, not a throw — unlike `DATABASE_URL`/`SESSION_SECRET`, this env var's absence is an expected, non-fatal dev-mode default), and exports `notifyBestEffort`, which every call site wraps its notification call in so a Resend outage never blocks a booking/cancellation/status-change that already succeeded in the DB.

Two existing repo functions had their success return shape extended to carry the patient/appointment fields notifications need — no new queries, just returning more of what was already fetched: `booking-repo.ts`'s `cancelAppointmentByRefAndMobile` (the `appt` row was already SELECTed before the cancel decision) and `admin-repo.ts`'s `updateAppointmentStatus` (added a `.returning()` to its `UPDATE`, which previously had none). Both callers (`actions.ts`, `admin-actions.ts`) then call the already-existing `getServiceById` for the service name, mirroring `createBooking`'s existing pattern rather than adding a join to either write-repo file. Admin status transitions only notify on `confirmed`/`cancelled` — not `completed`/`no_show`.

`src/app/api/cron/reminders/route.ts` is the app's first (and so far only) Route Handler — `middleware.ts`'s matcher (`/admin/:path*`) doesn't touch it. Its `CRON_SECRET` check happens per-request inside the handler (401 on mismatch), not at module load like `DATABASE_URL`/`SESSION_SECRET` — a misconfigured cron secret should 401 one route, not crash the whole app at boot. Vercel Cron (configured in `vercel.json`, once daily at `"0 2 * * *"` = 10:00 AM Manila) auto-attaches `Authorization: Bearer <CRON_SECRET>` when that env var is set on the Vercel project — verify this against current Vercel docs before depending on it if it's ever changed. The route reuses `admin-queries.ts`'s `getAppointmentsInRange` (already joins `services`) for "tomorrow's" pending/confirmed appointments — no new query needed.

## Playwright E2E

One spec, `e2e/booking-happy-path.spec.ts`: books an appointment through the full public flow (home → service → date → time → form) and immediately cancels it using the ref code + mobile number it just captured — self-cleaning, and deliberately leaves the optional email field blank so a real Resend send is never triggered as a side effect of a run. It runs against the regular dev `DATABASE_URL` (via `playwright.config.ts`'s `webServer: { command: "npm run dev", ... }`), not a dedicated seeded test database — `DATABASE_URL_TEST` is migrated but never seeded (`seed.ts` is hardcoded to the main `db` client), and building an isolated auto-seeded E2E database wasn't judged worth it yet for one spec on a single-clinic app; see the README's "E2E tests" section for the full reasoning and the `playwright.config.ts` comment showing the `webServer.env` override that would point at `DATABASE_URL_TEST` if that ever changes. `npx playwright install chromium` is a one-time manual step (not part of `npm install`, matching how Vitest doesn't auto-install anything either).

## Migrations

Two migrations exist: `0000_init.sql` (drizzle-kit generated, all four tables) and `0001_btree_gist_exclusion_constraint.sql` (hand-written, see above). Both are tracked in `drizzle/meta/_journal.json`. `npm run db:migrate` applies them to `DATABASE_URL`; `npm run db:migrate:test` (via `drizzle.config.test.ts`) applies the same migrations to `DATABASE_URL_TEST`, which the Phase 3 integration test depends on.
