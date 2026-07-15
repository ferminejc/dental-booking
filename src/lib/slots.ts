import { manilaCalendarDaysBetween, manilaDateTimeToUtc, manilaWeekday, utcToManilaDateString } from "./timezone";
import type { ManilaDateString, Weekday } from "./timezone";

export interface OpenHoursDay {
  open: string; // "HH:MM", 24h, zero-padded
  close: string; // "HH:MM", 24h, zero-padded
}

// Canonical shape of clinicSettings.openHours (jsonb) — see src/db/seed.ts for the shape in use.
export type OpenHours = Record<Weekday, OpenHoursDay | null>;

// Only pending/confirmed appointments count against availability.
export type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";

export interface ExistingAppointment {
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
}

export interface BlockedTime {
  startsAt: Date;
  endsAt: Date;
}

export interface AvailableSlot {
  start: Date;
  end: Date;
}

export interface GenerateAvailableSlotsParams {
  date: ManilaDateString; // the single Manila calendar date being queried
  serviceDurationMinutes: number;
  openHours: OpenHours;
  slotMinutes: number;
  minLeadHours: number;
  maxAdvanceDays: number;
  now: Date; // caller-supplied "current" UTC instant — never read internally
  blockedTimes: BlockedTime[];
  appointments: ExistingAppointment[];
}

// Half-open range overlap, exactly matching the DB's tstzrange `&&` semantics:
// [s1,e1) and [s2,e2) overlap iff s1 < e2 && s2 < e1. Ranges that only touch
// at a boundary (one ends exactly when the other starts) do not overlap.
export function rangesOverlap(s1: Date, e1: Date, s2: Date, e2: Date): boolean {
  return s1 < e2 && s2 < e1;
}

const BLOCKING_STATUSES: ReadonlySet<AppointmentStatus> = new Set(["pending", "confirmed"]);

export function generateAvailableSlots(params: GenerateAvailableSlotsParams): AvailableSlot[] {
  const {
    date,
    serviceDurationMinutes,
    openHours,
    slotMinutes,
    minLeadHours,
    maxAdvanceDays,
    now,
    blockedTimes,
    appointments,
  } = params;

  const today = utcToManilaDateString(now);
  const diffDays = manilaCalendarDaysBetween(today, date);
  if (diffDays < 0 || diffDays > maxAdvanceDays) return [];

  const weekday = manilaWeekday(date);
  const hours = openHours[weekday];
  if (hours === null) return [];

  const dayOpenUtc = manilaDateTimeToUtc(date, hours.open);
  const dayCloseUtc = manilaDateTimeToUtc(date, hours.close);

  const earliestBookable = new Date(now.getTime() + minLeadHours * 3_600_000);
  const durationMs = serviceDurationMinutes * 60_000;
  const stepMs = slotMinutes * 60_000;

  const blockingAppointments = appointments.filter((a) => BLOCKING_STATUSES.has(a.status));

  const slots: AvailableSlot[] = [];
  for (
    let candidateStart = dayOpenUtc;
    candidateStart < dayCloseUtc;
    candidateStart = new Date(candidateStart.getTime() + stepMs)
  ) {
    const candidateEnd = new Date(candidateStart.getTime() + durationMs);

    if (candidateEnd > dayCloseUtc) continue;
    if (candidateStart < earliestBookable) continue;

    if (blockedTimes.some((b) => rangesOverlap(candidateStart, candidateEnd, b.startsAt, b.endsAt))) {
      continue;
    }

    if (
      blockingAppointments.some((a) =>
        rangesOverlap(candidateStart, candidateEnd, a.startsAt, a.endsAt),
      )
    ) {
      continue;
    }

    slots.push({ start: candidateStart, end: candidateEnd });
  }

  return slots;
}
