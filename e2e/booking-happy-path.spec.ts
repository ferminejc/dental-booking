import { expect, test } from "@playwright/test";

// Matches formatTimeLabel's output shape (src/lib/timezone.ts), e.g.
// "9:00 AM" / "2:30 PM" — used to pick a time-slot link apart from a
// date-picker link on the same page, since both share the /book/ href
// prefix once a date is selected.
const TIME_LABEL_PATTERN = /^\d{1,2}:\d{2}\s(AM|PM)$/;

// Mirrors REF_CODE_ALPHABET in src/lib/ref-code.ts (excludes 0/O/1/I).
const REF_CODE_PATTERN = /^DNT-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

function randomPhMobile(): string {
  // 09XXXXXXXXX — the shape phMobileSchema normalizes to +639XXXXXXXXX, and
  // the most natural shape a patient would actually type.
  const subscriber = String(Math.floor(100_000_000 + Math.random() * 900_000_000));
  return `09${subscriber}`;
}

test("book an appointment, then cancel it (self-cleaning against the dev DB)", async ({ page }) => {
  const patientName = "E2E Test Patient";
  const patientMobile = randomPhMobile();

  // 1. Homepage -> pick the first service. `exact: true` matters: the
  // homepage also has a "Need to cancel or reschedule a booking?" link, and
  // Playwright's default name match is a case-insensitive substring match,
  // so "Book" would otherwise also match "booking".
  await page.goto("/");
  await page.getByRole("link", { name: "Book", exact: true }).first().click();

  // 2. Date/slot picker, no date selected yet: pick the first available
  // date. Unavailable dates render as a plain <div aria-disabled="true">,
  // never a link, so any <a> here is guaranteed a real, bookable date.
  await expect(page).toHaveURL(/\/book\/[^/]+$/);
  await page.locator('a[href^="/book/"]').first().click();

  // 3. Same page re-renders with a "Pick a time" section below the dates.
  // Both rows link under /book/..., so disambiguate by the time label's
  // text shape, not href.
  await expect(page).toHaveURL(/\/book\/[^/]+\/\d{4}-\d{2}-\d{2}$/);
  const timeSlot = page.getByRole("link", { name: TIME_LABEL_PATTERN }).first();
  await expect(timeSlot).toBeVisible();
  await timeSlot.click();

  // 4. Booking form.
  await expect(page).toHaveURL(/\/book\/[^/]+\/\d{4}-\d{2}-\d{2}\/\d{4}$/);
  await page.getByLabel("Full name").fill(patientName);
  await page.getByLabel("Mobile number").fill(patientMobile);
  // Email/notes are optional and deliberately left blank: a real Resend send
  // could fire off patientEmail when RESEND_API_KEY is set, and this test
  // must not trigger a real outbound email as a side effect of a run. The
  // honeypot "website" field is never touched, exactly as a real user (who
  // can't see it — it's aria-hidden and off-screen) would leave it.
  await page.getByRole("button", { name: "Confirm booking" }).click();

  // 5. Success screen — capture the ref code for the cancel step.
  await expect(page.getByRole("heading", { name: "Booking received" })).toBeVisible();
  const refCode = (await page.getByText(REF_CODE_PATTERN).innerText()).trim();
  expect(refCode).toMatch(REF_CODE_PATTERN);

  // 6. Cancel flow — self-cleaning: same ref code + same mobile number used
  // to book, leaving the dev DB's one touched row `cancelled`, same as any
  // real cancellation, not inflating "pending" counts an admin would see.
  await page.goto("/cancel");
  await page.getByLabel("Reference code").fill(refCode);
  await page.getByLabel("Mobile number").fill(patientMobile);
  await page.getByRole("button", { name: "Cancel booking" }).click();

  await expect(page.getByRole("heading", { name: "Booking cancelled" })).toBeVisible();
});
