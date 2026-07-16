# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Online appointment booking for a small PH dental clinic. Full requirements, data model, and the phase-by-phase build plan live in `SPEC.md` — read it before making architectural decisions, it is the source of truth, not this file.

**Status: Phases 1–3.** Scaffold, DB schema, migrations, seed script, the pure slot-generation engine (`src/lib/slots.ts` + `src/lib/timezone.ts`), and the public booking flow end-to-end (services list, date/slot picker, booking form, cancel form, Server Actions in `src/lib/actions.ts`, Zod validation in `src/lib/validation.ts`) exist, with a Vitest unit suite plus one integration test (`src/lib/booking-repo.integration.test.ts`) that fires two concurrent bookings for the same slot against a real test database and asserts the exclusion constraint stops the second. There is no admin auth/dashboard, no notifications, and no E2E tests yet. Don't assume any of that exists — check before referencing it.

## Commands

```bash
npm run dev                # dev server (Turbopack)
npm run build               # production build (Turbopack)
npm run lint                # eslint
npm run test                # vitest run, excluding *.integration.test.ts — single pass, use this for CI/"did it work" checks
npm run test:watch          # vitest — interactive watch mode for local dev, same integration-test exclusion
npm run test:integration    # vitest run src/lib/booking-repo.integration.test.ts — needs DATABASE_URL_TEST migrated (npm run db:migrate:test)

npm run db:generate          # drizzle-kit generate — diff src/db/schema.ts into a new migration
npm run db:migrate           # drizzle-kit migrate — apply pending migrations in drizzle/
npm run db:migrate:test      # drizzle-kit migrate --config=drizzle.config.test.ts — applies the same migrations to DATABASE_URL_TEST
npm run db:seed              # tsx src/db/seed.ts — wipe and reseed clinic settings/services/appointments
npm run db:studio            # drizzle-kit studio
```

Vitest config (`vitest.config.ts`) scopes `test.include` to `src/**/*.test.ts` — deliberately narrower than Vitest's default glob, which also matches `*.spec.ts`, to avoid colliding with Phase 5's future Playwright specs. Playwright itself isn't installed yet (Phase 5 per `SPEC.md`). It also aliases `@` to `./src` (mirroring `tsconfig.json`'s path) since Vitest doesn't read tsconfig paths on its own — needed once `src/lib/booking-repo.ts` and friends started using `@/db/schema`-style imports. The `test`/`test:watch` scripts pass `--exclude "**/*.integration.test.ts"` so the fast/CI path never needs `DATABASE_URL_TEST` connectivity; `test:integration` targets that file explicitly and bypasses the exclude.

**`drizzle-orm`'s `neon-http` driver never throws a `NeonDbError` directly** — it always wraps driver errors in a `DrizzleQueryError`, with the real error (SQLSTATE `code` and all) on `.cause`. `src/lib/booking-repo.ts`'s `asNeonDbError` helper unwraps this; a bare `err instanceof NeonDbError` check will never match and was the actual bug the concurrent-booking integration test caught the first time it ran against a real database.

Package manager is **npm** (`package-lock.json`) — don't introduce pnpm/yarn lockfiles or commands. The project started on pnpm during initial scaffolding and was switched to npm early in Phase 1; if you see any stray `pnpm-lock.yaml` or `pnpm-workspace.yaml`, they're leftovers to delete, not the source of truth. npm's newer install-script approval gate means new native deps (like a future db driver with prebuilt binaries) may need `npm approve-scripts --all` after `npm install` before they'll build.

## Tech stack

Fixed by `SPEC.md`; treat any deviation as something to flag, not decide unilaterally:

- Next.js 15 (App Router, Server Actions), TypeScript strict mode
- Tailwind CSS + shadcn/ui — initialized on **Radix** primitives (`radix-ui` package), not the newer Base UI preset shadcn's CLI defaults to. If you re-run `shadcn init`, pass `-b radix` or it will silently switch the primitive library and require reinstalling every component.
- Drizzle ORM + Postgres (Neon), using the `drizzle-orm/neon-http` driver (`@neondatabase/serverless`) — this is the serverless/edge-compatible driver, not `node-postgres`.
- Zod for validation (not yet introduced — will land in Phase 3, in a single `src/lib/validation.ts` file per the file-organization convention below).
- Admin auth: iron-session + env-var credentials, no auth framework (Phase 4, not built).
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

## Migrations

Two migrations exist: `0000_init.sql` (drizzle-kit generated, all four tables) and `0001_btree_gist_exclusion_constraint.sql` (hand-written, see above). Both are tracked in `drizzle/meta/_journal.json`. `npm run db:migrate` applies them to `DATABASE_URL`; `npm run db:migrate:test` (via `drizzle.config.test.ts`) applies the same migrations to `DATABASE_URL_TEST`, which the Phase 3 integration test depends on.
