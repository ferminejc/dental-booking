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
