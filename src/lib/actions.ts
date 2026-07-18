"use server";

import { db } from "@/db/client";
import { getServiceById, getSlotsForDate } from "./booking-queries";
import { cancelAppointmentByRefAndMobile, insertAppointment } from "./booking-repo";
import { formDataToObject } from "./form-data";
import { notificationService, notifyBestEffort } from "./notifications";
import type { AvailableSlot } from "./slots";
import { formatTimeLabel, manilaDateTimeToUtc, manilaTimeToUrlSegment, utcToManilaTimeString } from "./timezone";
import { bookingFormSchema, cancelFormSchema } from "./validation";

export interface SlotOption {
  time: string; // "HH:MM"
  timeSegment: string; // "HHMM", for building a /book/.../[time] link
  label: string; // "9:00 AM"
}

export type CreateBookingState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: Record<string, string[]>; formError?: string }
  | { status: "slot_taken"; freshSlots: SlotOption[] }
  | { status: "error"; message: string }
  | { status: "success"; refCode: string };

// Only these fields have a visible input for an error to attach to. Anything
// else (serviceId, date, time, the honeypot) folds into a generic message —
// this is also what keeps a honeypot hit indistinguishable from any other
// invalid submission to anyone probing the form.
const VISIBLE_BOOKING_FIELDS = new Set(["patientName", "patientMobile", "patientEmail", "notes"]);

function toSlotOptions(slots: AvailableSlot[]): SlotOption[] {
  return slots.map((s) => {
    const time = utcToManilaTimeString(s.start);
    return { time, timeSegment: manilaTimeToUrlSegment(time), label: formatTimeLabel(time) };
  });
}

export async function createBooking(
  _prevState: CreateBookingState,
  formData: FormData,
): Promise<CreateBookingState> {
  const raw = formDataToObject(formData, [
    "serviceId",
    "date",
    "time",
    "patientName",
    "patientMobile",
    "patientEmail",
    "notes",
    "website",
  ]);

  const parsed = bookingFormSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && VISIBLE_BOOKING_FIELDS.has(key)) {
        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
      }
    }
    const formError = Object.keys(fieldErrors).length === 0 ? "Please check your entry and try again." : undefined;
    return { status: "invalid", fieldErrors, formError };
  }

  const input = parsed.data;

  const service = await getServiceById(db, input.serviceId);
  if (!service || !service.active) {
    return { status: "invalid", fieldErrors: {}, formError: "This service is no longer available." };
  }

  const startsAt = manilaDateTimeToUtc(input.date, input.time);
  const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);
  const now = new Date();

  const currentSlots = await getSlotsForDate(db, {
    serviceDurationMinutes: service.durationMin,
    date: input.date,
    now,
  });
  const stillAvailable = currentSlots.some((s) => s.start.getTime() === startsAt.getTime());
  if (!stillAvailable) {
    return { status: "slot_taken", freshSlots: toSlotOptions(currentSlots) };
  }

  const result = await insertAppointment(db, {
    serviceId: input.serviceId,
    startsAt,
    endsAt,
    patientName: input.patientName,
    patientMobile: input.patientMobile,
    patientEmail: input.patientEmail,
    notes: input.notes,
  });

  if (!result.ok) {
    if (result.reason === "slot_taken") {
      const freshSlots = await getSlotsForDate(db, {
        serviceDurationMinutes: service.durationMin,
        date: input.date,
        now: new Date(),
      });
      return { status: "slot_taken", freshSlots: toSlotOptions(freshSlots) };
    }
    return { status: "error", message: "Something went wrong on our end. Please try again." };
  }

  await notifyBestEffort("sendBookingReceived", () =>
    notificationService.sendBookingReceived({
      refCode: result.refCode,
      patientName: input.patientName,
      patientMobile: input.patientMobile,
      patientEmail: input.patientEmail,
      serviceName: service.name,
      startsAt,
      endsAt,
    }),
  );

  return { status: "success", refCode: result.refCode };
}

export type CancelBookingState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: Record<string, string[]> }
  | { status: "not_found" }
  | { status: "already_resolved"; message: string }
  | { status: "success" };

const ALREADY_RESOLVED_MESSAGES: Record<string, string> = {
  cancelled: "This booking has already been cancelled.",
  completed: "This appointment has already been completed.",
  no_show: "This appointment was already marked as a no-show.",
};

export async function cancelBooking(
  _prevState: CancelBookingState,
  formData: FormData,
): Promise<CancelBookingState> {
  const raw = formDataToObject(formData, ["refCode", "patientMobile"]);

  const parsed = cancelFormSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string") {
        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
      }
    }
    return { status: "invalid", fieldErrors };
  }

  const result = await cancelAppointmentByRefAndMobile(db, parsed.data.refCode, parsed.data.patientMobile);

  if (result.ok) {
    const service = await getServiceById(db, result.serviceId);
    await notifyBestEffort("sendCancelled", () =>
      notificationService.sendCancelled({
        refCode: result.refCode,
        patientName: result.patientName,
        patientMobile: result.patientMobile,
        patientEmail: result.patientEmail ?? undefined,
        serviceName: service?.name ?? "your appointment",
        startsAt: result.startsAt,
        endsAt: result.endsAt,
      }),
    );
    return { status: "success" };
  }
  if (result.reason === "not_found") {
    return { status: "not_found" };
  }
  return {
    status: "already_resolved",
    message: ALREADY_RESOLVED_MESSAGES[result.status] ?? "This booking can no longer be cancelled.",
  };
}
