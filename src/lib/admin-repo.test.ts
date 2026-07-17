import { describe, expect, it } from "vitest";
import { canTransitionAppointmentStatus, validAppointmentTransitions } from "./admin-repo";

describe("validAppointmentTransitions", () => {
  it("allows a pending appointment to move to any actionable status", () => {
    expect(validAppointmentTransitions("pending")).toEqual(["confirmed", "completed", "cancelled", "no_show"]);
  });

  it("allows a confirmed appointment to move to any actionable status except itself", () => {
    expect(validAppointmentTransitions("confirmed")).toEqual(["completed", "cancelled", "no_show"]);
  });

  it("returns no valid transitions for terminal statuses", () => {
    expect(validAppointmentTransitions("completed")).toEqual([]);
    expect(validAppointmentTransitions("cancelled")).toEqual([]);
    expect(validAppointmentTransitions("no_show")).toEqual([]);
  });
});

describe("canTransitionAppointmentStatus", () => {
  it("allows pending -> confirmed/completed/cancelled/no_show", () => {
    expect(canTransitionAppointmentStatus("pending", "confirmed")).toBe(true);
    expect(canTransitionAppointmentStatus("pending", "completed")).toBe(true);
    expect(canTransitionAppointmentStatus("pending", "cancelled")).toBe(true);
    expect(canTransitionAppointmentStatus("pending", "no_show")).toBe(true);
  });

  it("rejects transitioning to the same status", () => {
    expect(canTransitionAppointmentStatus("confirmed", "confirmed")).toBe(false);
    expect(canTransitionAppointmentStatus("pending", "pending")).toBe(false);
  });

  it("rejects any transition out of a terminal status", () => {
    expect(canTransitionAppointmentStatus("completed", "pending")).toBe(false);
    expect(canTransitionAppointmentStatus("cancelled", "confirmed")).toBe(false);
    expect(canTransitionAppointmentStatus("no_show", "completed")).toBe(false);
  });
});
