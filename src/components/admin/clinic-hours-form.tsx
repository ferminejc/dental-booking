"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateClinicHoursAction, type ClinicHoursFormState } from "@/lib/admin-actions";
import type { OpenHours, OpenHoursDay } from "@/lib/slots";
import type { Weekday } from "@/lib/timezone";

const DAY_ORDER: { key: Weekday; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

const initialState: ClinicHoursFormState = { status: "idle" };

// Encodes the server data a DayRow was initialized from into its own key, so
// a genuine data change (e.g. a revalidation after another admin's edit)
// forces a remount instead of leaving the row's local `closed` state stale —
// `useState(initial === null)` only reads `initial` once, on first mount.
function dayRowKey(dayKey: Weekday, initial: OpenHoursDay | null): string {
  return `${dayKey}-${initial ? `${initial.open}-${initial.close}` : "closed"}`;
}

function DayRow({
  dayKey,
  label,
  initial,
  errors,
}: {
  dayKey: Weekday;
  label: string;
  initial: OpenHoursDay | null;
  errors?: string[];
}) {
  const [closed, setClosed] = useState(initial === null);
  const closedId = `${dayKey}-closed`;
  const openId = `${dayKey}-open`;
  const closeId = `${dayKey}-close`;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
      <span className="w-24 font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <Switch id={closedId} name={`${dayKey}_closed`} checked={closed} onCheckedChange={setClosed} />
        <Label htmlFor={closedId} className="text-sm text-muted-foreground">
          Closed
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor={openId} className="sr-only">
          {label} opening time
        </Label>
        <Input
          id={openId}
          type="time"
          name={`${dayKey}_open`}
          defaultValue={initial?.open}
          disabled={closed}
          className="w-32"
        />
        <span className="text-muted-foreground">to</span>
        <Label htmlFor={closeId} className="sr-only">
          {label} closing time
        </Label>
        <Input
          id={closeId}
          type="time"
          name={`${dayKey}_close`}
          defaultValue={initial?.close}
          disabled={closed}
          className="w-32"
        />
      </div>
      {errors?.map((msg) => (
        <p key={msg} className="w-full text-sm text-destructive">
          {msg}
        </p>
      ))}
    </div>
  );
}

export function ClinicHoursForm({ initialHours }: { initialHours: OpenHours }) {
  const [state, formAction] = useActionState(updateClinicHoursAction, initialState);
  const fieldErrors = state.status === "invalid" ? state.fieldErrors : {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.status === "success" && (
        <Alert>
          <AlertDescription>Clinic hours updated.</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-3">
        {DAY_ORDER.map(({ key, label }) => (
          <DayRow
            key={dayRowKey(key, initialHours[key])}
            dayKey={key}
            label={label}
            initial={initialHours[key]}
            errors={fieldErrors[key]}
          />
        ))}
      </div>
      <SubmitButton label="Save hours" pendingLabel="Saving..." className="w-fit" />
    </form>
  );
}
