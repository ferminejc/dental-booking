import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { getAppointmentsInRange } from "@/lib/admin-queries";
import { notificationService, notifyBestEffort } from "@/lib/notifications";
import { addDaysToManilaDate, manilaDateTimeToUtc, utcToManilaDateString } from "@/lib/timezone";

// Checked per-request, not at module load — an unset/misconfigured
// CRON_SECRET should make this endpoint a no-op 401, not crash the app at
// boot the way a missing DATABASE_URL does. Vercel Cron attaches
// `Authorization: Bearer <CRON_SECRET>` automatically when that env var is
// set on the project.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const today = utcToManilaDateString(new Date());
  const tomorrow = addDaysToManilaDate(today, 1);
  const startUtc = manilaDateTimeToUtc(tomorrow, "00:00");
  const endUtc = manilaDateTimeToUtc(addDaysToManilaDate(tomorrow, 1), "00:00");

  const candidates = await getAppointmentsInRange(db, {
    startUtc,
    endUtc,
    statuses: ["pending", "confirmed"],
  });

  // getAppointmentsInRange checks range *overlap*, not "starts on this
  // Manila calendar day" — a service crossing midnight could otherwise
  // start today and still overlap tomorrow's window, sending a "tomorrow"
  // reminder for an appointment that's actually tonight. Not reachable with
  // today's seeded clinic hours (none allow crossing midnight), but not
  // guarded against otherwise, so filter explicitly rather than assume it.
  const appointmentsTomorrow = candidates.filter((appt) => utcToManilaDateString(appt.startsAt) === tomorrow);

  let remindersSent = 0;
  for (const appt of appointmentsTomorrow) {
    const sent = await notifyBestEffort(`sendReminder(${appt.refCode})`, () =>
      notificationService.sendReminder({
        refCode: appt.refCode,
        patientName: appt.patientName,
        patientMobile: appt.patientMobile,
        patientEmail: appt.patientEmail ?? undefined,
        serviceName: appt.serviceName,
        startsAt: appt.startsAt,
        endsAt: appt.endsAt,
      }),
    );
    if (sent) remindersSent++;
  }

  return NextResponse.json({ ok: true, remindersSent, total: appointmentsTomorrow.length });
}
