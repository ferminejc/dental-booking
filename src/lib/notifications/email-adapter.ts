import { Resend } from "resend";
import { formatAppointmentWhen, type NotificationPayload, type NotificationService } from "./notification-service";

const CLINIC_NAME = "Bright Smile Dental Clinic"; // matches src/db/seed.ts; hardcoded rather than
// fetched from clinic_settings to avoid a DB round-trip inside a notification adapter this phase.

// Resend's sandbox sender — works without a verified domain, but can only
// deliver to the email address associated with the Resend account itself.
// Fine for local dev/testing; a verified sending domain is required before
// this goes out to real patients (see README's Deploying section).
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

export class EmailAdapter implements NotificationService {
  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async sendBookingReceived(payload: NotificationPayload): Promise<void> {
    const { dateLabel, timeLabel } = formatAppointmentWhen(payload);
    await this.send(
      payload,
      `Booking received — ${payload.refCode}`,
      `Hi ${payload.patientName},\n\n` +
        `We've received your booking request for ${payload.serviceName} on ${dateLabel} at ${timeLabel}.\n\n` +
        `Your reference code is ${payload.refCode} — please save it, you'll need it (with your mobile number) to cancel.\n\n` +
        `We'll confirm your appointment shortly.\n\n— ${CLINIC_NAME}`,
    );
  }

  async sendConfirmed(payload: NotificationPayload): Promise<void> {
    const { dateLabel, timeLabel } = formatAppointmentWhen(payload);
    await this.send(
      payload,
      `Appointment confirmed — ${payload.refCode}`,
      `Hi ${payload.patientName},\n\n` +
        `Your ${payload.serviceName} appointment on ${dateLabel} at ${timeLabel} is now confirmed.\n\n` +
        `Reference: ${payload.refCode}. Please arrive 10 minutes early.\n\nSee you then!\n\n— ${CLINIC_NAME}`,
    );
  }

  async sendReminder(payload: NotificationPayload): Promise<void> {
    const { dateLabel, timeLabel } = formatAppointmentWhen(payload);
    await this.send(
      payload,
      `Reminder: your appointment is tomorrow — ${payload.refCode}`,
      `Hi ${payload.patientName},\n\n` +
        `Just a reminder that your ${payload.serviceName} appointment is tomorrow, ${dateLabel} at ${timeLabel}.\n\n` +
        `Reference: ${payload.refCode}. Need to reschedule or cancel? Use your reference code and mobile number on our booking site.\n\n— ${CLINIC_NAME}`,
    );
  }

  async sendCancelled(payload: NotificationPayload): Promise<void> {
    const { dateLabel, timeLabel } = formatAppointmentWhen(payload);
    await this.send(
      payload,
      `Appointment cancelled — ${payload.refCode}`,
      `Hi ${payload.patientName},\n\n` +
        `Your ${payload.serviceName} appointment on ${dateLabel} at ${timeLabel} (Ref: ${payload.refCode}) has been cancelled.\n\n` +
        `If this wasn't you, or you'd like to rebook, just visit our booking site.\n\n— ${CLINIC_NAME}`,
    );
  }

  // Gracefully no-ops (not throws) when there's no email — SMS is out of
  // scope this phase, so a patient with no email on file simply gets no
  // notification via this channel yet.
  private async send(payload: NotificationPayload, subject: string, text: string): Promise<void> {
    if (!payload.patientEmail) {
      console.log(`[email] skipped ${payload.refCode} — no email on file`);
      return;
    }
    const { error } = await this.client.emails.send({
      from: FROM_EMAIL,
      to: payload.patientEmail,
      subject,
      text,
    });
    if (error) {
      throw new Error(`Resend error sending to ${payload.patientEmail}: ${error.message}`);
    }
  }
}
