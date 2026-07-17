import { and, gt, eq, inArray, lt } from "drizzle-orm";
import { appointments, blockedTimes, services } from "@/db/schema";
import type { DbClient } from "./booking-queries";
import type { AppointmentStatus } from "./slots";

export interface AdminAppointmentRow {
  id: string;
  refCode: string;
  patientName: string;
  patientMobile: string;
  patientEmail: string | null;
  notes: string | null;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  serviceId: string;
  serviceName: string;
  serviceDurationMin: number;
}

// Serves both the list/week views (no statuses filter — every status shows)
// and the blocked-time overlap-warning check (statuses: ["pending","confirmed"]).
export async function getAppointmentsInRange(
  client: DbClient,
  params: { startUtc: Date; endUtc: Date; statuses?: AppointmentStatus[] },
): Promise<AdminAppointmentRow[]> {
  const conditions = [lt(appointments.startsAt, params.endUtc), gt(appointments.endsAt, params.startUtc)];
  if (params.statuses) {
    conditions.push(inArray(appointments.status, params.statuses));
  }

  return client
    .select({
      id: appointments.id,
      refCode: appointments.refCode,
      patientName: appointments.patientName,
      patientMobile: appointments.patientMobile,
      patientEmail: appointments.patientEmail,
      notes: appointments.notes,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      serviceId: services.id,
      serviceName: services.name,
      serviceDurationMin: services.durationMin,
    })
    .from(appointments)
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .where(and(...conditions))
    .orderBy(appointments.startsAt);
}

export interface BlockedTimeRow {
  id: string;
  startsAt: Date;
  endsAt: Date;
  reason: string | null;
}

// Unfiltered — the whole table. Fine at clinic scale for Phase 4; flag if
// this table ever grows large enough to need pagination.
export async function getAllBlockedTimes(client: DbClient): Promise<BlockedTimeRow[]> {
  return client
    .select({
      id: blockedTimes.id,
      startsAt: blockedTimes.startsAt,
      endsAt: blockedTimes.endsAt,
      reason: blockedTimes.reason,
    })
    .from(blockedTimes)
    .orderBy(blockedTimes.startsAt);
}

export interface AdminServiceRow {
  id: string;
  name: string;
  durationMin: number;
  pricePhp: number;
  active: boolean;
}

// Unlike getActiveServices (booking-queries.ts), includes inactive rows —
// admin needs to see and reactivate them.
export async function getAllServices(client: DbClient): Promise<AdminServiceRow[]> {
  return client
    .select({
      id: services.id,
      name: services.name,
      durationMin: services.durationMin,
      pricePhp: services.pricePhp,
      active: services.active,
    })
    .from(services)
    .orderBy(services.name);
}
