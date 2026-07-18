import { formatDateLabel, formatTimeLabel, utcToManilaDateString, utcToManilaTimeString } from "../timezone";

export interface NotificationPayload {
  refCode: string;
  patientName: string;
  patientMobile: string;
  patientEmail?: string; // DB column is nullable — callers convert null -> undefined
  serviceName: string;
  startsAt: Date; // UTC instant
  endsAt: Date; // UTC instant
}

export interface NotificationService {
  sendBookingReceived(payload: NotificationPayload): Promise<void>;
  sendConfirmed(payload: NotificationPayload): Promise<void>;
  sendReminder(payload: NotificationPayload): Promise<void>;
  sendCancelled(payload: NotificationPayload): Promise<void>;
}

// Shared by every adapter that needs Manila-local labels derived from the
// payload's UTC instants.
export function formatAppointmentWhen(payload: Pick<NotificationPayload, "startsAt" | "endsAt">): {
  dateLabel: string;
  timeLabel: string;
  endTimeLabel: string;
} {
  return {
    dateLabel: formatDateLabel(utcToManilaDateString(payload.startsAt)),
    timeLabel: formatTimeLabel(utcToManilaTimeString(payload.startsAt)),
    endTimeLabel: formatTimeLabel(utcToManilaTimeString(payload.endsAt)),
  };
}
