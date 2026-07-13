import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
]);

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  durationMin: integer("duration_min").notNull(),
  pricePhp: integer("price_php").notNull(),
  active: boolean("active").notNull().default(true),
});

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    refCode: text("ref_code").notNull().unique(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id),
    patientName: text("patient_name").notNull(),
    patientMobile: text("patient_mobile").notNull(),
    patientEmail: text("patient_email"),
    notes: text("notes"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: appointmentStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("appointments_starts_at_idx").on(table.startsAt)],
);

export const blockedTimes = pgTable("blocked_times", {
  id: uuid("id").primaryKey().defaultRandom(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  reason: text("reason"),
});

// Single-row settings table; the app always reads/writes the row with id = 1.
export const clinicSettings = pgTable(
  "clinic_settings",
  {
    id: integer("id").primaryKey().default(1),
    name: text("name").notNull(),
    address: text("address").notNull(),
    mobile: text("mobile").notNull(),
    openHours: jsonb("open_hours").notNull(),
    slotMinutes: integer("slot_minutes").notNull().default(30),
    minLeadHours: integer("min_lead_hours").notNull().default(2),
    maxAdvanceDays: integer("max_advance_days").notNull().default(30),
  },
  (table) => [check("clinic_settings_single_row", sql`${table.id} = 1`)],
);
