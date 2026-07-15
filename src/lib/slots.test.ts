import { describe, expect, it } from "vitest";
import { generateAvailableSlots, rangesOverlap } from "./slots";
import type { AppointmentStatus, ExistingAppointment, OpenHours } from "./slots";

const WEEKDAY_HOURS = { open: "09:00", close: "18:00" };
const SATURDAY_HOURS = { open: "09:00", close: "15:00" };

const OPEN_HOURS: OpenHours = {
  mon: WEEKDAY_HOURS,
  tue: WEEKDAY_HOURS,
  wed: WEEKDAY_HOURS,
  thu: WEEKDAY_HOURS,
  fri: WEEKDAY_HOURS,
  sat: SATURDAY_HOURS,
  sun: null,
};

// 2026-07-15 is a Wednesday. Default `now` is the day before, at Manila
// midnight — comfortably past the 2-hour lead time for every slot that day,
// but still well within the 30-day max-advance window for it.
const WEDNESDAY = "2026-07-15";
const DEFAULT_NOW = new Date("2026-07-14T00:00:00.000Z");

function baseParams(overrides: Partial<Parameters<typeof generateAvailableSlots>[0]> = {}) {
  return {
    date: WEDNESDAY,
    serviceDurationMinutes: 30,
    openHours: OPEN_HOURS,
    slotMinutes: 30,
    minLeadHours: 2,
    maxAdvanceDays: 30,
    now: DEFAULT_NOW,
    blockedTimes: [],
    appointments: [],
    ...overrides,
  };
}

function appointment(startsAt: string, endsAt: string, status: AppointmentStatus): ExistingAppointment {
  return { startsAt: new Date(startsAt), endsAt: new Date(endsAt), status };
}

function starts(slots: { start: Date }[]): string[] {
  return slots.map((s) => s.start.toISOString());
}

describe("rangesOverlap", () => {
  it("treats touching boundaries as non-overlapping", () => {
    expect(
      rangesOverlap(
        new Date("2026-07-15T01:00:00.000Z"),
        new Date("2026-07-15T01:30:00.000Z"),
        new Date("2026-07-15T01:30:00.000Z"),
        new Date("2026-07-15T02:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("treats any actual overlap as overlapping", () => {
    expect(
      rangesOverlap(
        new Date("2026-07-15T01:00:00.000Z"),
        new Date("2026-07-15T01:45:00.000Z"),
        new Date("2026-07-15T01:30:00.000Z"),
        new Date("2026-07-15T02:00:00.000Z"),
      ),
    ).toBe(true);
  });
});

describe("generateAvailableSlots — baseline", () => {
  it("returns all 18 half-hour slots for a normal weekday with nothing booked", () => {
    const slots = generateAvailableSlots(baseParams());
    expect(slots).toHaveLength(18);
    expect(slots[0].start.toISOString()).toBe("2026-07-15T01:00:00.000Z"); // 09:00 Manila
    expect(slots.at(-1)!.start.toISOString()).toBe("2026-07-15T09:30:00.000Z"); // 17:30 Manila
    expect(slots.at(-1)!.end.toISOString()).toBe("2026-07-15T10:00:00.000Z"); // 18:00 Manila
  });
});

describe("generateAvailableSlots — overlapping appointments", () => {
  it("excludes a slot that directly overlaps a confirmed appointment", () => {
    const slots = generateAvailableSlots(
      baseParams({
        appointments: [appointment("2026-07-15T01:00:00.000Z", "2026-07-15T01:30:00.000Z", "confirmed")],
      }),
    );
    expect(starts(slots)).not.toContain("2026-07-15T01:00:00.000Z");
    expect(slots).toHaveLength(17);
  });

  it("includes a back-to-back slot that starts exactly when a confirmed appointment ends", () => {
    const slots = generateAvailableSlots(
      baseParams({
        appointments: [appointment("2026-07-15T01:00:00.000Z", "2026-07-15T01:30:00.000Z", "confirmed")],
      }),
    );
    const slot = slots.find((s) => s.start.toISOString() === "2026-07-15T01:30:00.000Z");
    expect(slot).toBeDefined();
    expect(slot!.end.toISOString()).toBe("2026-07-15T02:00:00.000Z");
  });

  it("does not block on completed, cancelled, or no_show appointments", () => {
    const slots = generateAvailableSlots(
      baseParams({
        appointments: [
          appointment("2026-07-15T01:00:00.000Z", "2026-07-15T01:30:00.000Z", "completed"),
          appointment("2026-07-15T01:00:00.000Z", "2026-07-15T01:30:00.000Z", "cancelled"),
          appointment("2026-07-15T01:00:00.000Z", "2026-07-15T01:30:00.000Z", "no_show"),
        ],
      }),
    );
    expect(starts(slots)).toContain("2026-07-15T01:00:00.000Z");
  });

  it("blocks on a pending appointment", () => {
    const slots = generateAvailableSlots(
      baseParams({
        appointments: [appointment("2026-07-15T01:00:00.000Z", "2026-07-15T01:30:00.000Z", "pending")],
      }),
    );
    expect(starts(slots)).not.toContain("2026-07-15T01:00:00.000Z");
  });

  it("excludes a slot with a partial overlap against a longer (45-min) appointment", () => {
    const slots = generateAvailableSlots(
      baseParams({
        appointments: [appointment("2026-07-15T01:00:00.000Z", "2026-07-15T01:45:00.000Z", "confirmed")],
      }),
    );
    expect(starts(slots)).not.toContain("2026-07-15T01:30:00.000Z");
  });
});

describe("generateAvailableSlots — blocked times", () => {
  it("excludes slots overlapping a lunch block, and includes back-to-back slots on both sides", () => {
    const slots = generateAvailableSlots(
      baseParams({
        blockedTimes: [{ startsAt: new Date("2026-07-15T04:00:00.000Z"), endsAt: new Date("2026-07-15T05:00:00.000Z") }],
      }),
    );
    expect(starts(slots)).not.toContain("2026-07-15T04:00:00.000Z"); // 12:00 Manila
    expect(starts(slots)).not.toContain("2026-07-15T04:30:00.000Z"); // 12:30 Manila
    expect(starts(slots)).toContain("2026-07-15T03:30:00.000Z"); // 11:30 Manila, ends exactly at block start
    expect(starts(slots)).toContain("2026-07-15T05:00:00.000Z"); // 13:00 Manila, starts exactly at block end
  });

  it("includes a slot whose exact (non-rounded) duration ends before a non-slot-aligned block starts", () => {
    // Blocked 09:50-10:00 Manila; a 45-min service starting at 09:00 Manila ends
    // exactly at 09:45, five minutes before the block — genuinely bookable.
    // A buggy implementation that rounds the candidate up to 2 slots (09:00-10:00)
    // would wrongly reject this.
    const slots = generateAvailableSlots(
      baseParams({
        serviceDurationMinutes: 45,
        blockedTimes: [{ startsAt: new Date("2026-07-15T01:50:00.000Z"), endsAt: new Date("2026-07-15T02:00:00.000Z") }],
      }),
    );
    const slot = slots.find((s) => s.start.toISOString() === "2026-07-15T01:00:00.000Z");
    expect(slot).toBeDefined();
    expect(slot!.end.toISOString()).toBe("2026-07-15T01:45:00.000Z");
  });
});

describe("generateAvailableSlots — lead-time cutoff", () => {
  it("is inclusive at exactly the minimum lead time", () => {
    const now = new Date("2026-07-15T00:00:00.000Z"); // 08:00 Manila; +2h = 10:00 Manila
    const slots = generateAvailableSlots(baseParams({ now }));
    expect(starts(slots)).not.toContain("2026-07-15T01:00:00.000Z"); // 09:00 Manila — too soon
    expect(starts(slots)).not.toContain("2026-07-15T01:30:00.000Z"); // 09:30 Manila — too soon
    expect(starts(slots)).toContain("2026-07-15T02:00:00.000Z"); // 10:00 Manila — exactly 2h out
  });

  it("excludes a slot one second short of the lead-time cutoff", () => {
    const now = new Date("2026-07-15T00:00:01.000Z");
    const slots = generateAvailableSlots(baseParams({ now }));
    expect(starts(slots)).not.toContain("2026-07-15T02:00:00.000Z"); // 1 second short
    expect(starts(slots)).toContain("2026-07-15T02:30:00.000Z");
  });
});

describe("generateAvailableSlots — day boundaries", () => {
  it("returns no slots on a day the clinic is closed, regardless of other inputs", () => {
    const slots = generateAvailableSlots(
      baseParams({
        date: "2026-07-19", // Sunday
        appointments: [appointment("2026-07-19T01:00:00.000Z", "2026-07-19T01:30:00.000Z", "confirmed")],
      }),
    );
    expect(slots).toEqual([]);
  });

  it("excludes a candidate that would spill past closing time", () => {
    const slots = generateAvailableSlots(baseParams({ serviceDurationMinutes: 45 }));
    expect(starts(slots)).toContain("2026-07-15T09:00:00.000Z"); // 17:00 Manila, ends 17:45
    expect(starts(slots)).not.toContain("2026-07-15T09:30:00.000Z"); // 17:30 Manila, would end 18:15
  });
});

describe("generateAvailableSlots — appointments longer than one slot", () => {
  it("blocks both slot-start positions a 45-minute appointment overlaps", () => {
    const slots = generateAvailableSlots(
      baseParams({
        appointments: [appointment("2026-07-15T02:00:00.000Z", "2026-07-15T02:45:00.000Z", "confirmed")],
      }),
    );
    expect(starts(slots)).not.toContain("2026-07-15T02:00:00.000Z"); // 10:00 Manila
    expect(starts(slots)).not.toContain("2026-07-15T02:30:00.000Z"); // 10:30 Manila — still overlaps the tail
    expect(starts(slots)).toContain("2026-07-15T03:00:00.000Z"); // 11:00 Manila — clear
  });
});

describe("generateAvailableSlots — max-advance-days boundary", () => {
  const now = new Date("2026-07-15T00:00:00.000Z"); // "today" is 2026-07-15 Manila

  it("allows a date exactly maxAdvanceDays out", () => {
    const slots = generateAvailableSlots(baseParams({ date: "2026-08-14", now })); // Friday, +30 days
    expect(slots).toHaveLength(18);
  });

  it("rejects a date one day beyond maxAdvanceDays", () => {
    const slots = generateAvailableSlots(baseParams({ date: "2026-08-15", now })); // +31 days
    expect(slots).toEqual([]);
  });

  it("rejects a date before today", () => {
    const slots = generateAvailableSlots(baseParams({ date: "2026-07-14", now }));
    expect(slots).toEqual([]);
  });
});
