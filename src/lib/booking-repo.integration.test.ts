import "../db/load-env";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appointments, services } from "../db/schema";
import { testDb } from "../db/test-client";
import { insertAppointment } from "./booking-repo";

// The exclusion constraint (drizzle/0001_btree_gist_exclusion_constraint.sql)
// is the one piece of booking-rules logic that can't be unit-tested with a
// pure function — it only proves itself under real concurrent writes against
// Postgres, so this runs against DATABASE_URL_TEST rather than a mock.
describe("insertAppointment — concurrent booking race", () => {
  let serviceId: string;

  beforeAll(async () => {
    const [service] = await testDb
      .insert(services)
      .values({ name: "Integration Test Service", durationMin: 30, pricePhp: 100, active: true })
      .returning({ id: services.id });
    serviceId = service.id;
  });

  afterAll(async () => {
    await testDb.delete(appointments).where(eq(appointments.serviceId, serviceId));
    await testDb.delete(services).where(eq(services.id, serviceId));
  });

  it("lets exactly one of two simultaneous bookings for the same slot succeed", async () => {
    const startsAt = new Date("2026-09-01T01:00:00.000Z");
    const endsAt = new Date("2026-09-01T01:30:00.000Z");

    const [a, b] = await Promise.all([
      insertAppointment(testDb, {
        serviceId,
        startsAt,
        endsAt,
        patientName: "Race Patient A",
        patientMobile: "+639170000001",
      }),
      insertAppointment(testDb, {
        serviceId,
        startsAt,
        endsAt,
        patientName: "Race Patient B",
        patientMobile: "+639170000002",
      }),
    ]);

    const results = [a, b];
    const succeeded = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ ok: false, reason: "slot_taken" });
  });
});
