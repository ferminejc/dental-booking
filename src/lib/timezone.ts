import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const MANILA_TIME_ZONE = "Asia/Manila";

// "YYYY-MM-DD" — a calendar date, not an instant.
export type ManilaDateString = string;

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseDateString(date: ManilaDateString): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

// Interprets `time` ("HH:MM") as wall-clock time on `date` in Asia/Manila and
// returns the equivalent UTC instant. Must pass a plain string with no
// trailing Z/offset — fromZonedTime only takes the "interpret in timeZone"
// branch when the string has no timezone marker of its own.
export function manilaDateTimeToUtc(date: ManilaDateString, time: string): Date {
  return fromZonedTime(`${date}T${time}:00`, MANILA_TIME_ZONE);
}

// toZonedTime writes the target zone's wall-clock fields via the *local*
// setters (setFullYear/setHours), so the result must be read back with local
// getters (getFullYear/getHours), never getUTC* — that would silently return
// the wrong value regardless of what timezone this process is running in.
export function utcToManilaDateString(utcInstant: Date): ManilaDateString {
  const zoned = toZonedTime(utcInstant, MANILA_TIME_ZONE);
  return `${zoned.getFullYear()}-${pad2(zoned.getMonth() + 1)}-${pad2(zoned.getDate())}`;
}

export function utcToManilaTimeString(utcInstant: Date): string {
  const zoned = toZonedTime(utcInstant, MANILA_TIME_ZONE);
  return `${pad2(zoned.getHours())}:${pad2(zoned.getMinutes())}`;
}

// Weekday-of-a-calendar-date is timezone-free once you already have a Manila
// "YYYY-MM-DD" string — deliberately plain calendar arithmetic, not routed
// through date-fns-tz.
export function manilaWeekday(date: ManilaDateString): Weekday {
  const { year, month, day } = parseDateString(date);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

// b - a, in whole calendar days. Timezone-free string arithmetic — negative
// if b is before a.
export function manilaCalendarDaysBetween(a: ManilaDateString, b: ManilaDateString): number {
  const da = parseDateString(a);
  const db = parseDateString(b);
  const utcA = Date.UTC(da.year, da.month - 1, da.day);
  const utcB = Date.UTC(db.year, db.month - 1, db.day);
  return Math.round((utcB - utcA) / 86_400_000);
}

// date + days, as a calendar date string. Timezone-free — Date.UTC normalizes
// out-of-range days/months automatically (e.g. day 32 rolls into next month).
export function addDaysToManilaDate(date: ManilaDateString, days: number): ManilaDateString {
  const { year, month, day } = parseDateString(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

const WEEKDAY_OFFSET_FROM_MONDAY: Record<Weekday, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

// The Monday (inclusive) of the Manila calendar week containing `date` — the
// admin week view's default anchor.
export function mondayOfManilaWeek(date: ManilaDateString): ManilaDateString {
  return addDaysToManilaDate(date, -WEEKDAY_OFFSET_FROM_MONDAY[manilaWeekday(date)]);
}

// "2026-07-15" -> "Wed, Jul 15". Anchored at UTC midnight purely to reuse
// Intl's formatting with an explicit timeZone: "UTC" pin — there's no actual
// zone conversion happening, just extracting the same y/m/d the string
// already represents into a localized label.
export function formatDateLabel(date: ManilaDateString): string {
  const { year, month, day } = parseDateString(date);
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

// "09:00" -> "9:00 AM". Pure string/number formatting, no zone conversion —
// the input is already a Manila-local wall-clock time.
export function formatTimeLabel(time: string): string {
  const [hourStr, minute] = time.split(":");
  const hour = Number(hourStr);
  const period = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${period}`;
}

// Colon-free time representation for URL path segments — ":" is a valid but
// easy-to-mishandle character in a path segment, so routes use "0900" and
// convert at the boundary.
export function manilaTimeToUrlSegment(time: string): string {
  return time.replace(":", "");
}

export function manilaTimeFromUrlSegment(segment: string): string {
  return `${segment.slice(0, 2)}:${segment.slice(2)}`;
}
