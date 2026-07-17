"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-fit">
      {pending ? "Saving..." : "Save hours"}
    </Button>
  );
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

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
      <span className="w-24 font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <Switch name={`${dayKey}_closed`} checked={closed} onCheckedChange={setClosed} />
        <Label className="text-sm text-muted-foreground">Closed</Label>
      </div>
      <div className="flex items-center gap-2">
        <Input type="time" name={`${dayKey}_open`} defaultValue={initial?.open} disabled={closed} className="w-32" />
        <span className="text-muted-foreground">to</span>
        <Input type="time" name={`${dayKey}_close`} defaultValue={initial?.close} disabled={closed} className="w-32" />
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
          <DayRow key={key} dayKey={key} label={label} initial={initialHours[key]} errors={fieldErrors[key]} />
        ))}
      </div>
      <SubmitButton />
    </form>
  );
}
