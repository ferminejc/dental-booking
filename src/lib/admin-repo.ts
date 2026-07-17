import { eq } from "drizzle-orm";
import { appointments, blockedTimes, clinicSettings, services } from "@/db/schema";
import type { DbClient } from "./booking-queries";
import type { AppointmentStatus, OpenHours } from "./slots";

// Only pending/confirmed are "live" states an admin acts on; from either one,
// the front desk can move directly to any of the other three actionable
// statuses (no forced staging through "confirmed" first — a walk-in the
// front desk forgot to confirm can go straight to "completed"). Terminal
// statuses (completed/cancelled/no_show) have zero valid transitions.
const LIVE_STATUSES: ReadonlySet<AppointmentStatus> = new Set(["pending", "confirmed"]);
const ACTIONABLE_TARGETS: readonly AppointmentStatus[] = ["confirmed", "completed", "cancelled", "no_show"];

export function validAppointmentTransitions(current: AppointmentStatus): AppointmentStatus[] {
  if (!LIVE_STATUSES.has(current)) return [];
  return ACTIONABLE_TARGETS.filter((target) => target !== current);
}

export function canTransitionAppointmentStatus(current: AppointmentStatus, next: AppointmentStatus): boolean {
  return validAppointmentTransitions(current).includes(next);
}

export type UpdateStatusResult =
  | { ok: true }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "invalid_transition"; currentStatus: AppointmentStatus };

// Note: pending<->confirmed transitions can never trip the appointments
// exclusion constraint — both statuses are already inside its
// WHERE (status IN ('pending','confirmed')) predicate, so an UPDATE that
// only flips between them doesn't change constraint-set membership. No
// asNeonDbError handling needed here.
export async function updateAppointmentStatus(
  client: DbClient,
  appointmentId: string,
  newStatus: AppointmentStatus,
): Promise<UpdateStatusResult> {
  const [appt] = await client
    .select({ status: appointments.status })
    .from(appointments)
    .where(eq(appointments.id, appointmentId));

  if (!appt) return { ok: false, reason: "not_found" };
  if (!canTransitionAppointmentStatus(appt.status, newStatus)) {
    return { ok: false, reason: "invalid_transition", currentStatus: appt.status };
  }

  await client.update(appointments).set({ status: newStatus }).where(eq(appointments.id, appointmentId));
  return { ok: true };
}

export interface NewBlockedTimeInput {
  startsAt: Date;
  endsAt: Date;
  reason?: string;
}

// No exclusion constraint on blocked_times (confirmed against schema.ts — it
// only applies to appointments), so overlaps here are a plain insert; the
// overlap *warning* against existing appointments is a read-then-decide step
// the caller (admin-actions.ts) does before calling this.
export async function insertBlockedTime(client: DbClient, input: NewBlockedTimeInput): Promise<{ id: string }> {
  const [row] = await client.insert(blockedTimes).values(input).returning({ id: blockedTimes.id });
  return row;
}

export async function deleteBlockedTime(client: DbClient, id: string): Promise<{ ok: boolean }> {
  const result = await client.delete(blockedTimes).where(eq(blockedTimes.id, id)).returning({ id: blockedTimes.id });
  return { ok: result.length > 0 };
}

export interface ServiceInput {
  name: string;
  durationMin: number;
  pricePhp: number;
}

export async function insertService(client: DbClient, input: ServiceInput): Promise<{ id: string }> {
  const [row] = await client.insert(services).values(input).returning({ id: services.id });
  return row;
}

export async function updateService(client: DbClient, id: string, input: ServiceInput): Promise<{ ok: boolean }> {
  const result = await client.update(services).set(input).where(eq(services.id, id)).returning({ id: services.id });
  return { ok: result.length > 0 };
}

// Explicit target boolean (not a flip) — the form always submits the desired
// new value, never "toggle whatever it currently is." Never a hard delete —
// appointments.serviceId has a FK reference to this table.
export async function setServiceActive(client: DbClient, id: string, active: boolean): Promise<{ ok: boolean }> {
  const result = await client.update(services).set({ active }).where(eq(services.id, id)).returning({ id: services.id });
  return { ok: result.length > 0 };
}

// clinic_settings is a true singleton (CHECK id = 1) — always targets that row.
export async function updateClinicOpenHours(client: DbClient, openHours: OpenHours): Promise<void> {
  await client.update(clinicSettings).set({ openHours }).where(eq(clinicSettings.id, 1));
}
