import { NeonDbError } from "@neondatabase/serverless";
import { DrizzleQueryError, eq } from "drizzle-orm";
import { appointments } from "@/db/schema";
import type { DbClient } from "./booking-queries";
import { generateRefCode } from "./ref-code";
import type { AppointmentStatus } from "./slots";

// The neon-http driver never throws NeonDbError directly — drizzle-orm always
// wraps it in a DrizzleQueryError, with the real error (and its SQLSTATE
// `code`) on `.cause`. Confirmed against drizzle-orm@0.45's neon-http session.
function asNeonDbError(err: unknown): NeonDbError | undefined {
  if (err instanceof NeonDbError) return err;
  if (err instanceof DrizzleQueryError && err.cause instanceof NeonDbError) return err.cause;
  return undefined;
}

export interface NewAppointmentInput {
  serviceId: string;
  startsAt: Date;
  endsAt: Date;
  patientName: string;
  patientMobile: string;
  patientEmail?: string;
  notes?: string;
}

export type InsertAppointmentResult =
  | { ok: true; refCode: string; appointmentId: string }
  | { ok: false; reason: "slot_taken" }
  | { ok: false; reason: "ref_code_exhausted" };

const MAX_REF_CODE_ATTEMPTS = 5;

// Postgres SQLSTATEs, not string-matched error messages: 23P01 is
// exclusion_violation (the booking-rules exclusion constraint won the race),
// 23505 is unique_violation (here, specifically a ref_code collision, which
// the alphabet's 32^6 space makes vanishingly rare but not impossible).
export async function insertAppointment(
  client: DbClient,
  input: NewAppointmentInput,
): Promise<InsertAppointmentResult> {
  for (let attempt = 0; attempt < MAX_REF_CODE_ATTEMPTS; attempt++) {
    const refCode = generateRefCode();
    try {
      const [row] = await client
        .insert(appointments)
        .values({
          refCode,
          serviceId: input.serviceId,
          patientName: input.patientName,
          patientMobile: input.patientMobile,
          patientEmail: input.patientEmail,
          notes: input.notes,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
        })
        .returning({ id: appointments.id });
      return { ok: true, refCode, appointmentId: row.id };
    } catch (err) {
      const neonErr = asNeonDbError(err);
      if (neonErr?.code === "23P01") {
        return { ok: false, reason: "slot_taken" };
      }
      if (neonErr?.code === "23505" && neonErr.constraint === "appointments_ref_code_unique") {
        continue;
      }
      throw err;
    }
  }
  return { ok: false, reason: "ref_code_exhausted" };
}

export type CancelResult =
  | { ok: true }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "already_resolved"; status: AppointmentStatus };

// Looks up by ref_code alone, then compares patientMobile in code (not in
// the WHERE clause) so a wrong-mobile-for-a-real-code response can be made
// identical to a nonexistent-code response — deliberate anti-enumeration.
export async function cancelAppointmentByRefAndMobile(
  client: DbClient,
  refCode: string,
  patientMobile: string,
): Promise<CancelResult> {
  const [appt] = await client.select().from(appointments).where(eq(appointments.refCode, refCode));
  if (!appt || appt.patientMobile !== patientMobile) {
    return { ok: false, reason: "not_found" };
  }
  if (appt.status !== "pending" && appt.status !== "confirmed") {
    return { ok: false, reason: "already_resolved", status: appt.status };
  }
  await client.update(appointments).set({ status: "cancelled" }).where(eq(appointments.id, appt.id));
  return { ok: true };
}
