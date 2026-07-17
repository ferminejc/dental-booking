import { z } from "zod";
import { REF_CODE_ALPHABET } from "./ref-code";

export const PH_MOBILE_REGEX = /^\+639\d{9}$/;

// Accepts the common shapes a patient might actually type on a phone
// keyboard (0917..., 917..., 639...) and normalizes them to the canonical
// +639XXXXXXXXX form before the strict regex check below runs — forgiving
// input, strict storage. Matches the seed data's own format.
export function normalizePhMobile(raw: string): string {
  const trimmed = raw.trim().replace(/[\s-]/g, "");
  if (/^09\d{9}$/.test(trimmed)) return `+63${trimmed.slice(1)}`;
  if (/^9\d{9}$/.test(trimmed)) return `+63${trimmed}`;
  if (/^639\d{9}$/.test(trimmed)) return `+${trimmed}`;
  return trimmed;
}

export const phMobileSchema = z
  .string()
  .transform(normalizePhMobile)
  .pipe(z.string().regex(PH_MOBILE_REGEX, "Enter a valid PH mobile number, e.g. 0917 123 4567"));

const REF_CODE_REGEX = new RegExp(`^DNT-[${REF_CODE_ALPHABET}]{6}$`);

export const refCodeSchema = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .pipe(z.string().regex(REF_CODE_REGEX, "That doesn't look like a valid reference code"));

export const bookingFormSchema = z.object({
  serviceId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  patientName: z.string().trim().min(2, "Enter your full name").max(100),
  patientMobile: phMobileSchema,
  patientEmail: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => (v === "" ? undefined : v))
    .pipe(z.email("Enter a valid email address").optional()),
  notes: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .pipe(z.string().max(500, "Keep notes under 500 characters").optional()),
  // Honeypot: real visitors never see or fill this field. Any non-empty
  // value is treated identically to any other validation failure — no
  // distinct error path that would tip off a bot.
  website: z.string().max(0),
});

export type BookingFormInput = z.infer<typeof bookingFormSchema>;

export const cancelFormSchema = z.object({
  refCode: refCodeSchema,
  patientMobile: phMobileSchema,
});

export type CancelFormInput = z.infer<typeof cancelFormSchema>;

// ---- Admin schemas below (Phase 4) ----

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const appointmentStatusSchema = z.enum(["pending", "confirmed", "completed", "cancelled", "no_show"]);

export const updateAppointmentStatusFormSchema = z.object({
  appointmentId: z.uuid(),
  newStatus: appointmentStatusSchema,
});

// Date-range shape (not single-day+time-pair) so a multi-day holiday doesn't
// need one row per day. Comparing "YYYY-MM-DDTHH:MM" strings lexicographically
// is valid here since both halves are zero-padded ISO-like fields.
export const blockedTimeFormSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date"),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Pick a start time"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an end date"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Pick an end time"),
    reason: z
      .string()
      .trim()
      .transform((v) => (v === "" ? undefined : v))
      .pipe(z.string().max(200, "Keep the reason under 200 characters").optional()),
    // Present ("true") only on the resubmit-after-overlap-warning round trip.
    confirmOverlap: z.string().optional(),
  })
  .refine((d) => `${d.endDate}T${d.endTime}` > `${d.startDate}T${d.startTime}`, {
    message: "End must be after start",
    path: ["endTime"],
  });

export type BlockedTimeFormInput = z.infer<typeof blockedTimeFormSchema>;

// FormData values arrive as strings — z.coerce.number() parses them.
export const serviceFormSchema = z.object({
  name: z.string().trim().min(2, "Enter a service name").max(100),
  durationMin: z.coerce.number().int().positive().max(480, "Keep duration under 8 hours"),
  pricePhp: z.coerce.number().int().nonnegative().max(1_000_000, "Enter a realistic price"),
});

export type ServiceFormInput = z.infer<typeof serviceFormSchema>;

export const serviceIdSchema = z.object({ serviceId: z.uuid() });

// `closed` must be a real boolean by the time this runs (see the admin
// action's FormData mapping) — deliberately NOT z.coerce.boolean(), which
// would coerce the string "false" to true and silently corrupt every open day.
const openHoursDayInputSchema = z
  .object({
    closed: z.boolean(),
    open: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    close: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  })
  .refine((d) => d.closed || (!!d.open && !!d.close && d.close > d.open), {
    message: "Set an opening and closing time, or mark the day closed",
    path: ["close"],
  });

export const clinicHoursFormSchema = z.object({
  mon: openHoursDayInputSchema,
  tue: openHoursDayInputSchema,
  wed: openHoursDayInputSchema,
  thu: openHoursDayInputSchema,
  fri: openHoursDayInputSchema,
  sat: openHoursDayInputSchema,
  sun: openHoursDayInputSchema,
});

export type ClinicHoursFormInput = z.infer<typeof clinicHoursFormSchema>;
