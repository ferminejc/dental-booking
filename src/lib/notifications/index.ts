import { ConsoleAdapter } from "./console-adapter";
import { EmailAdapter } from "./email-adapter";
import type { NotificationService } from "./notification-service";

export type { NotificationPayload, NotificationService } from "./notification-service";

// Resolved once at module load. RESEND_API_KEY's absence is an *expected*,
// non-fatal condition (unlike DATABASE_URL/SESSION_SECRET, which throw) —
// this branches to ConsoleAdapter instead.
export const notificationService: NotificationService = process.env.RESEND_API_KEY
  ? new EmailAdapter(process.env.RESEND_API_KEY)
  : new ConsoleAdapter();

// Every call site (Server Actions, the cron route) goes through this — a
// Resend outage/bug must never surface as a failure of a booking,
// cancellation, or status change that already succeeded in the DB.
export async function notifyBestEffort(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[notifications] ${label} failed:`, err);
  }
}
