"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { cancelBooking, type CancelBookingState } from "@/lib/actions";

const initialState: CancelBookingState = { status: "idle" };

export function CancelForm() {
  const [state, formAction] = useActionState(cancelBooking, initialState);

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 text-center">
        <h2 className="text-lg font-semibold text-foreground">Booking cancelled</h2>
        <p className="text-sm text-muted-foreground">
          Your booking has been cancelled. That time slot is now open for others to book.
        </p>
        <Link href="/" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Back to services
        </Link>
      </div>
    );
  }

  const fieldErrors = state.status === "invalid" ? state.fieldErrors : {};
  const formError =
    state.status === "not_found"
      ? "We couldn't find a matching booking. Double-check your reference code and mobile number."
      : state.status === "already_resolved"
        ? state.message
        : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="refCode">Reference code</Label>
        <Input
          id="refCode"
          name="refCode"
          required
          placeholder="DNT-XXXXXX"
          className="h-12 text-base uppercase"
          aria-invalid={!!fieldErrors.refCode}
        />
        {fieldErrors.refCode?.map((msg) => (
          <p key={msg} className="text-sm text-destructive">
            {msg}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="patientMobile">Mobile number</Label>
        <Input
          id="patientMobile"
          name="patientMobile"
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0917 123 4567"
          className="h-12 text-base"
          aria-invalid={!!fieldErrors.patientMobile}
        />
        {fieldErrors.patientMobile?.map((msg) => (
          <p key={msg} className="text-sm text-destructive">
            {msg}
          </p>
        ))}
      </div>

      <SubmitButton label="Cancel booking" pendingLabel="Cancelling..." className="h-12 w-full text-base" />
    </form>
  );
}
