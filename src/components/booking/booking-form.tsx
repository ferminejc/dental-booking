"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { createBooking, type CreateBookingState } from "@/lib/actions";
import { formatDateLabel, formatTimeLabel } from "@/lib/timezone";

interface ServiceSummary {
  id: string;
  name: string;
  durationMin: number;
  pricePhp: number;
}

const initialState: CreateBookingState = { status: "idle" };

export function BookingForm({ service, date, time }: { service: ServiceSummary; date: string; time: string }) {
  const [state, formAction] = useActionState(createBooking, initialState);

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 text-center">
        <h2 className="text-lg font-semibold text-foreground">Booking received</h2>
        <p className="text-sm text-muted-foreground">
          {service.name} · {formatDateLabel(date)} at {formatTimeLabel(time)}
        </p>
        <p className="text-sm text-muted-foreground">Your reference code is</p>
        <p className="text-2xl font-semibold tracking-wide text-primary">{state.refCode}</p>
        <p className="text-sm text-muted-foreground">
          Status: pending confirmation. The clinic will confirm your booking shortly. Keep this code — you&apos;ll
          need it, with your mobile number, to cancel.
        </p>
        <Link href="/" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Back to services
        </Link>
      </div>
    );
  }

  if (state.status === "slot_taken") {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive">
          <AlertDescription>
            Sorry, that slot was just taken. Here are other open times for {formatDateLabel(date)}:
          </AlertDescription>
        </Alert>
        {state.freshSlots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No other open slots this day. Try another date.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {state.freshSlots.map((slot) => (
              <Link
                key={slot.time}
                href={`/book/${service.id}/${date}/${slot.timeSegment}`}
                className="flex h-12 items-center justify-center rounded-lg border border-border text-base hover:bg-muted"
              >
                {slot.label}
              </Link>
            ))}
          </div>
        )}
        <Link
          href={`/book/${service.id}/${date}`}
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          ← Back to date/time picker
        </Link>
      </div>
    );
  }

  const fieldErrors = state.status === "invalid" ? state.fieldErrors : {};
  const formError = state.status === "invalid" ? state.formError : state.status === "error" ? state.message : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
        {service.name} · {formatDateLabel(date)} at {formatTimeLabel(time)}
      </div>

      <input type="hidden" name="serviceId" value={service.id} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time} />

      {/* Honeypot: off-screen and out of tab order for real visitors, but
          present in the DOM for bots that blindly fill every input. */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="patientName">Full name</Label>
        <Input
          id="patientName"
          name="patientName"
          required
          autoComplete="name"
          className="h-12 text-base"
          aria-invalid={!!fieldErrors.patientName}
        />
        {fieldErrors.patientName?.map((msg) => (
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="patientEmail">Email (optional)</Label>
        <Input
          id="patientEmail"
          name="patientEmail"
          type="email"
          inputMode="email"
          autoComplete="email"
          className="h-12 text-base"
          aria-invalid={!!fieldErrors.patientEmail}
        />
        {fieldErrors.patientEmail?.map((msg) => (
          <p key={msg} className="text-sm text-destructive">
            {msg}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" name="notes" rows={3} aria-invalid={!!fieldErrors.notes} />
        {fieldErrors.notes?.map((msg) => (
          <p key={msg} className="text-sm text-destructive">
            {msg}
          </p>
        ))}
      </div>

      <SubmitButton label="Confirm booking" pendingLabel="Booking..." className="h-12 w-full text-base" />
    </form>
  );
}
