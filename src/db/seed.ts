import "./load-env";

import { generateRefCode } from "../lib/ref-code";
import { db } from "./client";
import { appointments, blockedTimes, clinicSettings, services } from "./schema";

// Asia/Manila is a fixed UTC+8 offset year-round (no DST), so this seed data
// can compute UTC timestamps directly without pulling in the date-fns-tz
// conversions the app builds in Phase 2.
function manilaDateTime(daysOffset: number, hour: number, minute = 0): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysOffset,
      hour - 8,
      minute,
    ),
  );
}

const WEEKDAY_HOURS = { open: "09:00", close: "18:00" };
const SATURDAY_HOURS = { open: "09:00", close: "15:00" };

async function seed() {
  console.log("Clearing existing data...");
  await db.delete(appointments);
  await db.delete(blockedTimes);
  await db.delete(services);
  await db.delete(clinicSettings);

  console.log("Inserting clinic settings...");
  await db.insert(clinicSettings).values({
    id: 1,
    name: "Bright Smile Dental Clinic",
    address: "123 Rizal St, Poblacion, Makati City",
    mobile: "+639171234567",
    openHours: {
      mon: WEEKDAY_HOURS,
      tue: WEEKDAY_HOURS,
      wed: WEEKDAY_HOURS,
      thu: WEEKDAY_HOURS,
      fri: WEEKDAY_HOURS,
      sat: SATURDAY_HOURS,
      sun: null,
    },
    slotMinutes: 30,
    minLeadHours: 2,
    maxAdvanceDays: 30,
  });

  console.log("Inserting services...");
  const [consultation, cleaning, bracesAdjustment, filling, extraction] =
    await db
      .insert(services)
      .values([
        { name: "Consultation", durationMin: 30, pricePhp: 500, active: true },
        {
          name: "Oral Prophylaxis / Cleaning",
          durationMin: 45,
          pricePhp: 800,
          active: true,
        },
        {
          name: "Braces Adjustment",
          durationMin: 30,
          pricePhp: 1000,
          active: true,
        },
        { name: "Filling", durationMin: 45, pricePhp: 1200, active: true },
        {
          name: "Tooth Extraction",
          durationMin: 30,
          pricePhp: 1500,
          active: true,
        },
      ])
      .returning();

  console.log("Inserting blocked time (lunch break)...");
  await db.insert(blockedTimes).values({
    startsAt: manilaDateTime(1, 12, 0),
    endsAt: manilaDateTime(1, 13, 0),
    reason: "Lunch break",
  });

  console.log("Inserting sample appointments...");
  await db.insert(appointments).values([
    {
      refCode: generateRefCode(),
      serviceId: consultation.id,
      patientName: "Maria Santos",
      patientMobile: "+639171112222",
      patientEmail: "maria.santos@example.com",
      startsAt: manilaDateTime(1, 10, 0),
      endsAt: manilaDateTime(1, 10, 30),
      status: "confirmed",
    },
    {
      refCode: generateRefCode(),
      serviceId: cleaning.id,
      patientName: "Juan Dela Cruz",
      patientMobile: "+639182223333",
      startsAt: manilaDateTime(1, 14, 0),
      endsAt: manilaDateTime(1, 14, 45),
      status: "pending",
    },
    {
      refCode: generateRefCode(),
      serviceId: filling.id,
      patientName: "Ana Reyes",
      patientMobile: "+639193334444",
      patientEmail: "ana.reyes@example.com",
      notes: "Sensitive to cold water",
      startsAt: manilaDateTime(-3, 9, 0),
      endsAt: manilaDateTime(-3, 9, 45),
      status: "completed",
    },
    {
      refCode: generateRefCode(),
      serviceId: bracesAdjustment.id,
      patientName: "Paolo Garcia",
      patientMobile: "+639204445555",
      startsAt: manilaDateTime(-2, 11, 0),
      endsAt: manilaDateTime(-2, 11, 30),
      status: "cancelled",
    },
    {
      refCode: generateRefCode(),
      serviceId: extraction.id,
      patientName: "Liza Mercado",
      patientMobile: "+639215556666",
      startsAt: manilaDateTime(-5, 15, 0),
      endsAt: manilaDateTime(-5, 15, 30),
      status: "no_show",
    },
  ]);

  console.log("Seed complete.");
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
