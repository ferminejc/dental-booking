"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createBlockedTimeAction, type CreateBlockedTimeState } from "@/lib/admin-actions";

const initialState: CreateBlockedTimeState = { status: "idle" };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </Button>
  );
}

export function BlockedTimeForm() {
  const [state, formAction] = useActionState(createBlockedTimeAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  const fieldErrors = state.status === "invalid" ? state.fieldErrors : {};
  const raw = state.status === "overlap_warning" ? state.raw : undefined;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4 rounded-lg border border-border p-4">
      {state.status === "success" && (
        <Alert>
          <AlertDescription>Blocked time created.</AlertDescription>
        </Alert>
      )}

      {state.status === "overlap_warning" && (
        <Alert>
          <AlertDescription>
            This overlaps {state.overlapping.length} existing appointment
            {state.overlapping.length === 1 ? "" : "s"}:
            <ul className="mt-1 list-disc pl-5">
              {state.overlapping.map((a, i) => (
                <li key={i}>
                  {a.patientName} — {a.startsAt}–{a.endsAt}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="startDate">Start date</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            required
            defaultValue={raw?.startDate}
            aria-invalid={!!fieldErrors.startDate}
          />
          {fieldErrors.startDate?.map((msg) => (
            <p key={msg} className="text-sm text-destructive">
              {msg}
            </p>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="startTime">Start time</Label>
          <Input
            id="startTime"
            name="startTime"
            type="time"
            required
            defaultValue={raw?.startTime}
            aria-invalid={!!fieldErrors.startTime}
          />
          {fieldErrors.startTime?.map((msg) => (
            <p key={msg} className="text-sm text-destructive">
              {msg}
            </p>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="endDate">End date</Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            required
            defaultValue={raw?.endDate}
            aria-invalid={!!fieldErrors.endDate}
          />
          {fieldErrors.endDate?.map((msg) => (
            <p key={msg} className="text-sm text-destructive">
              {msg}
            </p>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="endTime">End time</Label>
          <Input
            id="endTime"
            name="endTime"
            type="time"
            required
            defaultValue={raw?.endTime}
            aria-invalid={!!fieldErrors.endTime}
          />
          {fieldErrors.endTime?.map((msg) => (
            <p key={msg} className="text-sm text-destructive">
              {msg}
            </p>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reason">Reason (optional)</Label>
        <Textarea
          id="reason"
          name="reason"
          defaultValue={raw?.reason}
          placeholder="Lunch break, staff meeting, holiday..."
        />
        {fieldErrors.reason?.map((msg) => (
          <p key={msg} className="text-sm text-destructive">
            {msg}
          </p>
        ))}
      </div>

      {state.status === "overlap_warning" && <input type="hidden" name="confirmOverlap" value="true" />}

      <SubmitButton label={state.status === "overlap_warning" ? "Create anyway" : "Block this time"} />
    </form>
  );
}
