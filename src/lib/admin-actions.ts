"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import {
  deleteBlockedTime,
  insertBlockedTime,
  insertService,
  setServiceActive,
  updateAppointmentStatus,
  updateClinicOpenHours,
  updateService,
} from "./admin-repo";
import { getAppointmentsInRange } from "./admin-queries";
import { getServiceById } from "./booking-queries";
import { formDataToObject } from "./form-data";
import { requireAdminSession } from "./get-session";
import { notificationService, notifyBestEffort, type NotificationPayload } from "./notifications";
import type { OpenHours } from "./slots";
import {
  formatDateLabel,
  formatTimeLabel,
  manilaDateTimeToUtc,
  utcToManilaDateString,
  utcToManilaTimeString,
  type Weekday,
} from "./timezone";
import {
  blockedTimeFormSchema,
  clinicHoursFormSchema,
  serviceFormSchema,
  serviceIdSchema,
  updateAppointmentStatusFormSchema,
} from "./validation";

function fieldErrorsFromIssues(issues: { path: PropertyKey[]; message: string }[]): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
  }
  return fieldErrors;
}

// ---- Appointment status transitions ----

export type UpdateAppointmentStatusState =
  | { status: "idle" }
  | { status: "invalid" }
  | { status: "not_found" }
  | { status: "invalid_transition"; message: string }
  | { status: "success" };

export async function updateAppointmentStatusAction(
  _prevState: UpdateAppointmentStatusState,
  formData: FormData,
): Promise<UpdateAppointmentStatusState> {
  await requireAdminSession();

  const raw = formDataToObject(formData, ["appointmentId", "newStatus"]);
  const parsed = updateAppointmentStatusFormSchema.safeParse(raw);
  if (!parsed.success) return { status: "invalid" };

  const result = await updateAppointmentStatus(db, parsed.data.appointmentId, parsed.data.newStatus);
  if (result.ok) {
    revalidatePath("/admin");

    if (parsed.data.newStatus === "confirmed" || parsed.data.newStatus === "cancelled") {
      const service = await getServiceById(db, result.serviceId);
      const payload: NotificationPayload = {
        refCode: result.refCode,
        patientName: result.patientName,
        patientMobile: result.patientMobile,
        patientEmail: result.patientEmail ?? undefined,
        serviceName: service?.name ?? "your appointment",
        startsAt: result.startsAt,
        endsAt: result.endsAt,
      };
      if (parsed.data.newStatus === "confirmed") {
        await notifyBestEffort("sendConfirmed", () => notificationService.sendConfirmed(payload));
      } else {
        await notifyBestEffort("sendCancelled", () => notificationService.sendCancelled(payload));
      }
    }

    return { status: "success" };
  }
  if (result.reason === "not_found") return { status: "not_found" };
  return {
    status: "invalid_transition",
    message: `This appointment is already ${result.currentStatus} and can't be changed.`,
  };
}

// ---- Blocked times ----

export interface OverlappingAppointment {
  patientName: string;
  startsAt: string;
  endsAt: string;
}

export type CreateBlockedTimeState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: Record<string, string[]> }
  | { status: "overlap_warning"; overlapping: OverlappingAppointment[]; raw: Record<string, string> }
  | { status: "success" };

export async function createBlockedTimeAction(
  _prevState: CreateBlockedTimeState,
  formData: FormData,
): Promise<CreateBlockedTimeState> {
  await requireAdminSession();

  const raw = formDataToObject(formData, ["startDate", "startTime", "endDate", "endTime", "reason", "confirmOverlap"]);
  const parsed = blockedTimeFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "invalid", fieldErrors: fieldErrorsFromIssues(parsed.error.issues) };
  }

  const { startDate, startTime, endDate, endTime, reason, confirmOverlap } = parsed.data;
  const startsAt = manilaDateTimeToUtc(startDate, startTime);
  const endsAt = manilaDateTimeToUtc(endDate, endTime);

  if (confirmOverlap !== "true") {
    const overlapping = await getAppointmentsInRange(db, {
      startUtc: startsAt,
      endUtc: endsAt,
      statuses: ["pending", "confirmed"],
    });
    if (overlapping.length > 0) {
      return {
        status: "overlap_warning",
        overlapping: overlapping.map((a) => ({
          patientName: a.patientName,
          startsAt: `${formatDateLabel(utcToManilaDateString(a.startsAt))} ${formatTimeLabel(utcToManilaTimeString(a.startsAt))}`,
          endsAt: formatTimeLabel(utcToManilaTimeString(a.endsAt)),
        })),
        raw,
      };
    }
  }

  await insertBlockedTime(db, { startsAt, endsAt, reason });
  revalidatePath("/admin/blocked-times");
  return { status: "success" };
}

export async function deleteBlockedTimeAction(formData: FormData): Promise<void> {
  await requireAdminSession();

  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteBlockedTime(db, id);
  revalidatePath("/admin/blocked-times");
}

// ---- Services ----

export type ServiceFormState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: Record<string, string[]> }
  | { status: "success" };

export async function createServiceAction(
  _prevState: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  await requireAdminSession();

  const raw = formDataToObject(formData, ["name", "durationMin", "pricePhp"]);
  const parsed = serviceFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "invalid", fieldErrors: fieldErrorsFromIssues(parsed.error.issues) };
  }

  await insertService(db, parsed.data);
  revalidatePath("/admin/services");
  revalidatePath("/"); // public homepage's service list is statically prerendered
  return { status: "success" };
}

export async function updateServiceAction(
  _prevState: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  await requireAdminSession();

  const raw = formDataToObject(formData, ["serviceId", "name", "durationMin", "pricePhp"]);
  const idParsed = serviceIdSchema.safeParse(raw);
  const parsed = serviceFormSchema.safeParse(raw);
  if (!idParsed.success || !parsed.success) {
    const issues = [...(idParsed.success ? [] : idParsed.error.issues), ...(parsed.success ? [] : parsed.error.issues)];
    return { status: "invalid", fieldErrors: fieldErrorsFromIssues(issues) };
  }

  await updateService(db, idParsed.data.serviceId, parsed.data);
  revalidatePath("/admin/services");
  revalidatePath("/");
  return { status: "success" };
}

export async function setServiceActiveAction(formData: FormData): Promise<void> {
  await requireAdminSession();

  const raw = formDataToObject(formData, ["serviceId", "active"]);
  const parsed = serviceIdSchema.safeParse(raw);
  if (!parsed.success) return;

  await setServiceActive(db, parsed.data.serviceId, raw.active === "true");
  revalidatePath("/admin/services");
  revalidatePath("/"); // deactivating must remove it from the public service list immediately
}

// ---- Clinic hours ----

export type ClinicHoursFormState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: Record<string, string[]> }
  | { status: "success" };

const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// Flat per-day field names (mon_closed/mon_open/mon_close, ...) mapped into
// the nested shape clinicHoursFormSchema expects. `closed` must be a real
// boolean here, not a string — clinicHoursFormSchema deliberately doesn't use
// z.coerce.boolean(), which would coerce the string "false" to true.
function formDataToClinicHoursInput(formData: FormData) {
  const obj: Record<string, { closed: boolean; open?: string; close?: string }> = {};
  for (const day of WEEKDAYS) {
    obj[day] = {
      closed: formData.get(`${day}_closed`) === "on",
      open: String(formData.get(`${day}_open`) ?? "") || undefined,
      close: String(formData.get(`${day}_close`) ?? "") || undefined,
    };
  }
  return obj;
}

export async function updateClinicHoursAction(
  _prevState: ClinicHoursFormState,
  formData: FormData,
): Promise<ClinicHoursFormState> {
  await requireAdminSession();

  const raw = formDataToClinicHoursInput(formData);
  const parsed = clinicHoursFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "invalid", fieldErrors: fieldErrorsFromIssues(parsed.error.issues) };
  }

  const openHours = {} as OpenHours;
  for (const day of WEEKDAYS) {
    const d = parsed.data[day];
    openHours[day] = d.closed ? null : { open: d.open!, close: d.close! };
  }

  await updateClinicOpenHours(db, openHours);
  revalidatePath("/admin/hours");
  return { status: "success" };
}
