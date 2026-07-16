import { and, eq, gt, inArray, lt } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";
import { appointments, blockedTimes, clinicSettings, services } from "@/db/schema";
import { generateAvailableSlots } from "./slots";
import type { AvailableSlot, BlockedTime, ExistingAppointment, OpenHours } from "./slots";
import { addDaysToManilaDate, manilaDateTimeToUtc, utcToManilaDateString } from "./timezone";
import type { ManilaDateString } from "./timezone";

export type DbClient = NeonHttpDatabase<typeof schema>;

export async function getActiveServices(client: DbClient) {
  return client.select().from(services).where(eq(services.active, true));
}

export async function getServiceById(client: DbClient, id: string) {
  const [service] = await client.select().from(services).where(eq(services.id, id));
  return service;
}

export interface ClinicSettings {
  name: string;
  address: string;
  mobile: string;
  openHours: OpenHours;
  slotMinutes: number;
  minLeadHours: number;
  maxAdvanceDays: number;
}

export async function getClinicSettings(client: DbClient): Promise<ClinicSettings> {
  const [row] = await client.select().from(clinicSettings).where(eq(clinicSettings.id, 1));
  if (!row) throw new Error("clinic_settings row (id=1) is missing — run the seed script");
  return { ...row, openHours: row.openHours as OpenHours };
}

// Clinic-wide blockers: appointments and blocked times are never scoped to a
// single service — the exclusion constraint has no per-service partition, so
// one shared clinic calendar blocks availability for every service alike.
async function fetchBlockersInRange(
  client: DbClient,
  startUtc: Date,
  endUtc: Date,
): Promise<{ blockedTimes: BlockedTime[]; appointments: ExistingAppointment[] }> {
  const blocked = await client
    .select({ startsAt: blockedTimes.startsAt, endsAt: blockedTimes.endsAt })
    .from(blockedTimes)
    .where(and(lt(blockedTimes.startsAt, endUtc), gt(blockedTimes.endsAt, startUtc)));

  const appts = await client
    .select({ startsAt: appointments.startsAt, endsAt: appointments.endsAt, status: appointments.status })
    .from(appointments)
    .where(
      and(
        lt(appointments.startsAt, endUtc),
        gt(appointments.endsAt, startUtc),
        inArray(appointments.status, ["pending", "confirmed"]),
      ),
    );

  return { blockedTimes: blocked, appointments: appts };
}

export interface DateAvailability {
  date: ManilaDateString;
  available: boolean;
}

export async function getAvailableDatesForService(
  client: DbClient,
  params: { serviceDurationMinutes: number; now: Date },
): Promise<DateAvailability[]> {
  const settings = await getClinicSettings(client);
  const today = utcToManilaDateString(params.now);
  const windowEndUtc = manilaDateTimeToUtc(addDaysToManilaDate(today, settings.maxAdvanceDays + 1), "00:00");
  const blockers = await fetchBlockersInRange(client, params.now, windowEndUtc);

  const dates: DateAvailability[] = [];
  for (let offset = 0; offset <= settings.maxAdvanceDays; offset++) {
    const date = addDaysToManilaDate(today, offset);
    const slots = generateAvailableSlots({
      date,
      serviceDurationMinutes: params.serviceDurationMinutes,
      openHours: settings.openHours,
      slotMinutes: settings.slotMinutes,
      minLeadHours: settings.minLeadHours,
      maxAdvanceDays: settings.maxAdvanceDays,
      now: params.now,
      blockedTimes: blockers.blockedTimes,
      appointments: blockers.appointments,
    });
    dates.push({ date, available: slots.length > 0 });
  }
  return dates;
}

export async function getSlotsForDate(
  client: DbClient,
  params: { serviceDurationMinutes: number; date: ManilaDateString; now: Date },
): Promise<AvailableSlot[]> {
  const settings = await getClinicSettings(client);
  const dayStartUtc = manilaDateTimeToUtc(params.date, "00:00");
  const dayEndUtc = manilaDateTimeToUtc(addDaysToManilaDate(params.date, 1), "00:00");
  const blockers = await fetchBlockersInRange(client, dayStartUtc, dayEndUtc);

  return generateAvailableSlots({
    date: params.date,
    serviceDurationMinutes: params.serviceDurationMinutes,
    openHours: settings.openHours,
    slotMinutes: settings.slotMinutes,
    minLeadHours: settings.minLeadHours,
    maxAdvanceDays: settings.maxAdvanceDays,
    now: params.now,
    blockedTimes: blockers.blockedTimes,
    appointments: blockers.appointments,
  });
}
