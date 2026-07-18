# Dental Booking

Online appointment booking for a small PH dental clinic — patients book/cancel appointments themselves; front-desk staff manage everything from an admin dashboard. Built with Next.js 15 (App Router, Server Actions), Drizzle ORM + Postgres (Neon), and Tailwind/shadcn UI.

Full requirements and the phase-by-phase build plan live in [`SPEC.md`](./SPEC.md). Architecture notes, conventions, and gotchas for anyone (human or AI) working in this codebase live in [`CLAUDE.md`](./CLAUDE.md) — read that before making changes, and see it for the full command reference (tests, migrations, seeding, etc.).

## Setup

Package manager is **npm** — don't use yarn/pnpm/bun.

```bash
npm install
```

Create `.env.local` with:

```bash
DATABASE_URL=              # Neon Postgres connection string
DATABASE_URL_TEST=         # a second Neon (or local) Postgres database, used only by the integration test suite
SESSION_SECRET=            # iron-session cookie-sealing key, >= 32 chars, e.g. `openssl rand -base64 32`
ADMIN_USERNAME=            # admin login username
ADMIN_PASSWORD_HASH=       # generate with: npm run auth:hash -- "your-password"
RESEND_API_KEY=            # Resend API key for booking/reminder emails; omit to use a console-logging fallback (no real email sent)
RESEND_FROM_EMAIL=         # verified sender, e.g. "Clinic Name <noreply@yourclinic.example>"; defaults to Resend's sandbox sender if unset
CRON_SECRET=               # shared secret Vercel Cron sends to /api/cron/reminders; requests without a match are rejected
```

Then apply migrations and seed sample data:

```bash
npm run db:migrate
npm run db:seed
```

Run the dev server:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) for the public booking flow, or [http://localhost:3000/admin/login](http://localhost:3000/admin/login) for the admin dashboard.

## Commands

See [`CLAUDE.md`](./CLAUDE.md#commands) for the full list (tests, `db:*` scripts, `auth:hash`, etc.).

## E2E tests

One Playwright spec (`e2e/booking-happy-path.spec.ts`) drives the whole public
booking flow in a real Chromium browser: homepage → pick a service → pick the
first available date/time → submit the booking form → capture the reference
code → cancel that same booking. It runs against your regular dev database
(the same `DATABASE_URL` `npm run dev` already uses), not a separate seeded
test database — see below for why.

One-time setup (downloads a Chromium binary; not part of `npm install`):

```bash
npx playwright install chromium
```

Run it (starts `npm run dev` for you if it isn't already running, and reuses
it if it is):

```bash
npm run test:e2e
```

Requires `DATABASE_URL` to already be migrated and seeded (`npm run
db:migrate && npm run db:seed`) — exactly what local dev already requires, so
if `npm run dev` shows services on the homepage, this can run.

**Why the dev DB, not a dedicated test DB:** `DATABASE_URL_TEST` today is
migrated but never seeded (`src/db/seed.ts` is hardcoded to the main
`DATABASE_URL` client) — building a fully isolated, auto-seeded E2E database
would mean either parameterizing the seed script by DB client or adding
shell-based env overrides to npm scripts (this project has no `cross-env`,
and Windows vs. POSIX env-var syntax differ). For a single-clinic,
side-project-scale app with one E2E spec, that's not worth it yet: the test
books an appointment and then immediately cancels it using the ref code and
mobile number it just captured, so it's self-cleaning — the one row it
touches ends up `cancelled`, same as any real cancelled booking, and doesn't
skew the "pending" counts an admin would see. If this ever grows a real CI
pipeline or a bigger E2E suite, `playwright.config.ts`'s `webServer.env` can
point the spawned dev server at `DATABASE_URL_TEST` instead (see the comment
in that file) — once a seeding story for that database exists.

## Deploying

Target is Vercel + Neon (both free-tier at clinic scale).

1. **Create the Neon project.** In the [Neon console](https://console.neon.tech),
   create a project and copy its pooled connection string (the `-pooler`
   host — Vercel's serverless functions open many short-lived connections,
   and pooled connections are Neon's standard recommendation for that) as
   `DATABASE_URL`.
2. **Set environment variables in Vercel.** In the project's Settings →
   Environment Variables, add every var from this README's env-var list
   above (`DATABASE_URL`, `SESSION_SECRET`, `ADMIN_USERNAME`,
   `ADMIN_PASSWORD_HASH`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
   `CRON_SECRET`) for the Production environment. `DATABASE_URL_TEST` is not
   needed in Vercel — it's only used by the local integration test suite,
   never by the deployed app.
3. **Run migrations against production** before or during the first deploy:
   run `npm run db:migrate` from a machine/shell with `DATABASE_URL` set to
   the production Neon connection string. Then either `npm run db:seed`
   once (if you want the same sample services/settings the dev DB has) or,
   more realistically for a real clinic, skip seeding and enter the actual
   services/hours via the admin dashboard after first deploy instead.
4. **Deploy.** Push to the branch Vercel builds (or run `vercel --prod`).
   Vercel reads `vercel.json` (which registers the day-before-reminder cron
   at `/api/cron/reminders`, running once daily at 02:00 UTC / 10:00 AM
   Manila) and auto-registers that schedule on deploy — no separate cron
   setup step in the Vercel dashboard. Confirm `CRON_SECRET` is set as a
   Production env var matching what the route handler checks, or Vercel's
   own cron invocations will get rejected.
5. **Set up email.** Until `RESEND_API_KEY` is set, booking/confirmation/
   reminder/cancellation notifications just log to the server console
   instead of sending real email — safe for staging, not useful for real
   patients. To send real email: create a [Resend](https://resend.com)
   account, verify a sending domain, and set `RESEND_API_KEY` +
   `RESEND_FROM_EMAIL` (using an address on that verified domain — Resend's
   sandbox sender `onboarding@resend.dev`, used by default, can only deliver
   to the Resend account's own address, not real patients).
6. **Verify.** Visit the deployed homepage and `/admin/login` to confirm the
   app is talking to the new database.

**Changing clinic hours or services after deploy:** don't edit the database
by hand — log into `/admin/login` and use `/admin/hours` (weekly open/close
times per day) and `/admin/services` (add/edit/deactivate bookable
services). Both already exist specifically so this never needs a code change
or redeploy.
