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

## Deploying

Target is Vercel + Neon (both free-tier at clinic scale). A full deployment walkthrough is a later-phase item — see `SPEC.md`'s phase plan.
