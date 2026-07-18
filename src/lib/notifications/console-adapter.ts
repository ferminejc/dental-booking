import { formatAppointmentWhen, type NotificationPayload, type NotificationService } from "./notification-service";

// Automatic fallback when RESEND_API_KEY is unset (see index.ts) — keeps
// local dev free of any required external service, matching the rest of
// this app. Always logs, regardless of whether patientEmail is present, so
// all 4 triggers stay visible in dev even for phone-only patients.
export class ConsoleAdapter implements NotificationService {
  async sendBookingReceived(payload: NotificationPayload): Promise<void> {
    this.log("BOOKING_RECEIVED", payload);
  }

  async sendConfirmed(payload: NotificationPayload): Promise<void> {
    this.log("CONFIRMED", payload);
  }

  async sendReminder(payload: NotificationPayload): Promise<void> {
    this.log("REMINDER", payload);
  }

  async sendCancelled(payload: NotificationPayload): Promise<void> {
    this.log("CANCELLED", payload);
  }

  private log(kind: string, payload: NotificationPayload): void {
    const { dateLabel, timeLabel } = formatAppointmentWhen(payload);
    console.log(
      `[notify:${kind}] ${payload.refCode} — ${payload.patientName} <${payload.patientEmail ?? "no email"}> ` +
        `${payload.patientMobile} — ${payload.serviceName} on ${dateLabel} at ${timeLabel}`,
    );
  }
}
