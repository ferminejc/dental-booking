# Dental Clinic Online Booking — Project Spec

You are building an online appointment booking web app for a small dental clinic in the Philippines. Work spec-first, in phases, exactly as described in "How to work" at the bottom.

## Context

- Small PH clinic: one location, front desk currently books via Facebook Messenger and a paper logbook.
- Patients will reach this app from a "Book Now" button on the clinic's one-page website, almost always on a phone.
- Goals: patients self-book from real availability; front desk confirms and manages everything from a simple admin dashboard; fewer no-shows via reminders.

## Tech stack (use exactly this unless blocked — ask before substituting)

- Next.js 15 (App Router, Server Actions) + TypeScript in strict mode
- Tailwind CSS + shadcn/ui components
- Drizzle ORM + Postgres (Neon). Design for serverless: use the Neon driver.
- Zod for all input validation, schemas shared between client and server
- Admin auth: single admin, credentials from env vars (hashed password) + signed session cookie (e.g., iron-session). Do NOT add an auth framework — one admin login does not need one.
- Dates/times: date-fns with its timezone package; every conversion explicit to/from Asia/Manila
- Email: Resend if `RESEND_API_KEY` is set, otherwise a console-logging fallback adapter
- Tests: Vitest for unit/integration, Playwright for E2E
- Deploy target: Vercel + Neon free tiers (₱0/month at clinic scale), Vercel Cron for scheduled jobs

## Users

1. **Patient** — public, no account needed
2. **Clinic admin** — front desk staff or the dentist

## Core user stories

**Patient**
1. See the list of services with duration and price
2. Pick a service → see available dates (next 30 days) → pick a date → see open time slots
3. Enter name, PH mobile number (+63 format, validated), optional email, optional notes → submit → get a booking reference code and a "pending confirmation" screen
4. Cancel a booking by entering reference code + mobile number (both must match)

**Admin**
5. Log in at /admin
6. See today's and this week's appointments (list view + simple week calendar)
7. Confirm, cancel, mark completed, or mark no-show
8. Block off time (lunch, meetings, holidays) and edit weekly clinic hours
9. Manage services (create/edit/deactivate: name, duration in minutes, price)
10. See patient contact details so they can call or text

## Booking rules — the heart of the system, get this right

- Timezone: Asia/Manila everywhere. Store `timestamptz` (UTC) in the DB, always display Manila time.
- Available slots = weekly clinic hours − blocked times − existing appointments (status pending or confirmed).
- Slot granularity: 30 minutes. An appointment occupies ceil(duration / 30) consecutive slots.
- Minimum lead time: 2 hours from now. Maximum advance booking: 30 days.
- **Double booking must be impossible at the database level.** Use a Postgres exclusion constraint on the appointment time range — enable the `btree_gist` extension and add `EXCLUDE USING gist (tstzrange(starts_at, ends_at) WITH &&) WHERE (status IN ('pending', 'confirmed'))` via a hand-written migration (Drizzle won't generate this — write the SQL). The app must catch the constraint violation and return a friendly "that slot was just taken" message with fresh slots.
- Cancelling frees the slots immediately (the partial constraint above handles this automatically).

## Data model (Drizzle sketch — refine if needed, but keep the shape)

- `services(id, name, duration_min, price_php int, active bool)`
- `appointments(id, ref_code unique, service_id, patient_name, patient_mobile, patient_email?, notes?, starts_at timestamptz, ends_at timestamptz, status enum[pending, confirmed, completed, cancelled, no_show], created_at)`
- `blocked_times(id, starts_at, ends_at, reason?)`
- `clinic_settings(single row: name, address, mobile, open_hours jsonb keyed by weekday, slot_minutes, min_lead_hours, max_advance_days)`

## Notifications — build the interface now, channels later

- Define a `NotificationService` interface: `sendBookingReceived`, `sendConfirmed`, `sendReminder`, `sendCancelled`
- Implement `EmailAdapter` (Resend) with `ConsoleAdapter` fallback when no key is set
- Leave `SmsAdapter` as a typed stub with a TODO — PH SMS providers (Semaphore / Movider) come later
- Day-before reminders: route handler at `/api/cron/reminders`, protected by a `CRON_SECRET` header check, wired to Vercel Cron in `vercel.json`; document the schedule in the README

## Non-functional requirements

- Mobile-first, thumb-friendly booking flow — big tap targets, minimal typing
- Clean, trustworthy clinic aesthetic: white + teal, rounded corners, calm and simple (shadcn defaults tuned, not stock)
- Basic accessibility: labeled inputs, focus states, semantic HTML
- Basic anti-spam on the public booking form: honeypot field + strict server-side Zod validation
- Seed script with realistic data: clinic settings, 5 services (Consultation 30min ₱500, Oral Prophylaxis/Cleaning 45min ₱800, Braces Adjustment 30min ₱1,000, Filling 45min ₱1,200, Tooth Extraction 30min ₱1,500), and a handful of sample appointments across statuses
- README: setup steps, env vars, Neon + Vercel deployment walkthrough, how to change clinic hours and services

## Explicitly OUT of scope — do not build

- Patient accounts or logins
- Payments or deposits
- Multiple dentists with separate calendars (clinic-level availability only for MVP)
- Multiple clinics / branches
- Dental records, charts, x-rays, or any medical history (Data Privacy Act sensitive-data territory — deliberately excluded)
- Native mobile apps

## How to work

1. **Plan first.** Propose the architecture, file structure, and phase plan. Wait for my approval before writing code.
2. **Build in these phases.** After each phase: run the app and tests, tell me exactly what to verify in the browser, then commit with a conventional commit message.
   - **Phase 1:** Scaffold, Drizzle schema, hand-written migration enabling `btree_gist` + the exclusion constraint, seed script
   - **Phase 2:** Slot-generation engine as a pure, unit-tested function (Vitest). This is the riskiest logic — cover edge cases: overlapping appointments, blocked times, lead-time cutoffs, day boundaries, appointments longer than one slot
   - **Phase 3:** Public booking flow end to end. Write an integration test against a real test database that fires two concurrent bookings for the same slot and asserts exactly one succeeds — the exclusion constraint must be what stops the second
   - **Phase 4:** Admin auth + dashboard (list, week view, status actions, blocked times, services CRUD, clinic hours)
   - **Phase 5:** Notifications, Vercel Cron reminder route, Playwright E2E happy path, polish, README
3. Ask before adding any dependency not listed in the stack.
4. When a requirement is ambiguous, choose the simplest reasonable interpretation and flag it in your phase summary.
