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
