# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Online appointment booking for a small PH dental clinic. Full requirements, data model, and the phase-by-phase build plan live in `SPEC.md` — read it before making architectural decisions, it is the source of truth, not this file.

**Status: Phase 1 only.** Scaffold, DB schema, migrations, and seed script exist. There is no app UI beyond the default Next.js starter page, no Server Actions, no slot-generation engine, no admin auth/dashboard, no notifications, and no tests yet. Don't assume any of that exists — check before referencing it.

## Commands

```bash
npm run dev                # dev server (Turbopack)
npm run build               # production build (Turbopack)
npm run lint                # eslint

npm run db:generate          # drizzle-kit generate — diff src/db/schema.ts into a new migration
npm run db:migrate           # drizzle-kit migrate — apply pending migrations in drizzle/
npm run db:seed              # tsx src/db/seed.ts — wipe and reseed clinic settings/services/appointments
npm run db:studio            # drizzle-kit studio
```

No test runner is configured yet (Vitest/Playwright land in Phases 2 and 5 per `SPEC.md`).

Package manager is **npm** (`package-lock.json`) — don't introduce pnpm/yarn lockfiles or commands. The project started on pnpm during initial scaffolding and was switched to npm early in Phase 1; if you see any stray `pnpm-lock.yaml` or `pnpm-workspace.yaml`, they're leftovers to delete, not the source of truth. npm's newer install-script approval gate means new native deps (like a future db driver with prebuilt binaries) may need `npm approve-scripts --all` after `npm install` before they'll build.

## Tech stack

Fixed by `SPEC.md`; treat any deviation as something to flag, not decide unilaterally:

- Next.js 15 (App Router, Server Actions), TypeScript strict mode
- Tailwind CSS + shadcn/ui — initialized on **Radix** primitives (`radix-ui` package), not the newer Base UI preset shadcn's CLI defaults to. If you re-run `shadcn init`, pass `-b radix` or it will silently switch the primitive library and require reinstalling every component.
- Drizzle ORM + Postgres (Neon), using the `drizzle-orm/neon-http` driver (`@neondatabase/serverless`) — this is the serverless/edge-compatible driver, not `node-postgres`.
- Zod for validation (not yet introduced — will land in Phase 3, in a single `src/lib/validation.ts` file per the file-organization convention below).
- Admin auth: iron-session + env-var credentials, no auth framework (Phase 4, not built).
- date-fns + date-fns-tz for all Asia/Manila conversions (Phase 2, not built; see the timezone note below for what the interim seed script does instead).
- Email: Resend if `RESEND_API_KEY` is set, else a console-logging fallback (Phase 5, not built).
- Vitest (unit/integration), Playwright (E2E) — neither installed yet.
- Deploy target: Vercel + Neon free tier, Vercel Cron for the reminder job.

## Conventions

**File organization:** one flat file per concern, not a folder — e.g. `src/db/schema.ts` holds all four tables rather than a `schema/` directory per table. Only split a file into a folder once it exceeds roughly 300 lines. This applies project-wide (Zod schemas, notification adapters that are genuinely one interface with multiple implementations are the exception — those are separate concerns, not a split-for-size).

**Timezone handling:** Asia/Manila has a fixed UTC+8 offset year-round (no DST). All `timestamptz` columns store UTC; the app must always convert explicitly to/from Manila time at the boundaries (display, slot generation, lead-time checks). `src/db/seed.ts` currently does this with plain `Date.UTC(...)` arithmetic (`hour - 8`) because it predates the Phase 2 `date-fns-tz` utilities — once the canonical timezone helper exists, prefer it over ad hoc offset math anywhere else in the app.

**The exclusion constraint is sacred.** Double-booking is prevented at the database level by a Postgres `EXCLUDE USING gist` constraint on `appointments` (see `drizzle/0001_btree_gist_exclusion_constraint.sql`). This constraint — and the `CREATE EXTENSION btree_gist` it depends on — is **hand-written SQL**, generated via `drizzle-kit generate --custom --name=<...>`, never via a plain `drizzle-kit generate` diffed from `src/db/schema.ts`. Drizzle's schema file only owns the appointments table's columns; it has no representation of the exclusion constraint at all, so a future `generate` can't touch it. When adding new migrations that touch `appointments`, generate them normally and verify the constraint isn't dropped or altered.

**Standalone scripts vs. the Next.js runtime:** `src/db/client.ts` reads `process.env.DATABASE_URL` at module load and throws if unset — this works inside Next.js because it auto-loads `.env.local`, but scripts run via `tsx` (like `seed.ts`) need it loaded manually first. `src/db/load-env.ts` does that as a side-effect import and must be the *first* import in any standalone script that touches `./client`, because ES module imports are hoisted above other statements — importing `load-env` after `client` would run too late.

**dotenv prints an unsolicited promotional "tip" line** to stdout on every load (see `node_modules/dotenv/lib/main.js`'s `TIPS` array) unless `quiet: true` is passed. Always pass it: `config({ path: ".env.local", quiet: true })`.

## Data model

Four tables in `src/db/schema.ts`, matching `SPEC.md`'s sketch: `services`, `appointments` (with an `appointment_status` enum: `pending | confirmed | completed | cancelled | no_show`, and a btree index on `starts_at`), `blocked_times`, and `clinic_settings` (single-row, enforced with a `CHECK (id = 1)` constraint — always read/write the row where `id = 1`).

`clinic_settings.open_hours` is a `jsonb` column keyed by lowercase 3-letter weekday (`mon`...`sun`), each either `{ open: "HH:MM", close: "HH:MM" }` or `null` for closed. See `src/db/seed.ts` for the shape in use. There's no TypeScript type for this yet — Phase 2's slot engine should define the canonical type and this file should be updated to reference it once it exists.

Booking reference codes (`appointments.ref_code`) are generated by `src/lib/ref-code.ts`, format `DNT-XXXXXX` using an alphabet that excludes `0/O` and `1/I` to stay unambiguous when read aloud over the phone — not a UUID, since patients read these back to cancel a booking.

## Migrations

Two migrations exist: `0000_init.sql` (drizzle-kit generated, all four tables) and `0001_btree_gist_exclusion_constraint.sql` (hand-written, see above). Both are tracked in `drizzle/meta/_journal.json`. Migrations run against `DATABASE_URL` only — the test database (`DATABASE_URL_TEST` in `.env.local`) has not been migrated yet; that's expected to happen when Phase 3's integration tests are set up.
