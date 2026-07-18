import type { NotificationPayload, NotificationService } from "./notification-service";

// TODO: wire up a real PH SMS provider (Semaphore or Movider — see SPEC.md).
// This class exists only so NotificationService has a typed SMS
// implementation ready to slot in later; it is NOT selected by index.ts's
// adapter-picker this phase — Email/Console are the only two live channels.
export class SmsAdapter implements NotificationService {
  async sendBookingReceived(payload: NotificationPayload): Promise<void> {
    this.stub("sendBookingReceived", payload);
  }

  async sendConfirmed(payload: NotificationPayload): Promise<void> {
    this.stub("sendConfirmed", payload);
  }

  async sendReminder(payload: NotificationPayload): Promise<void> {
    this.stub("sendReminder", payload);
  }

  async sendCancelled(payload: NotificationPayload): Promise<void> {
    this.stub("sendCancelled", payload);
  }

  private stub(method: string, payload: NotificationPayload): void {
    console.log(
      `[sms:stub] ${method} not implemented (TODO: Semaphore/Movider) — would text ${payload.patientMobile} re: ${payload.refCode}`,
    );
  }
}
