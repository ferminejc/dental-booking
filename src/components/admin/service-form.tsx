"use client";

import { useActionState, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { createServiceAction, updateServiceAction, type ServiceFormState } from "@/lib/admin-actions";

const initialState: ServiceFormState = { status: "idle" };

interface ServiceFormProps {
  mode: "create" | "edit";
  service?: { id: string; name: string; durationMin: number; pricePhp: number };
}

export function ServiceForm({ mode, service }: ServiceFormProps) {
  const [open, setOpen] = useState(false);
  const action = mode === "create" ? createServiceAction : updateServiceAction;
  const [state, formAction] = useActionState(action, initialState);
  const idSuffix = service?.id ?? "new";

  useEffect(() => {
    if (state.status === "success") setOpen(false);
  }, [state.status]);

  const fieldErrors = state.status === "invalid" ? state.fieldErrors : {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={mode === "create" ? "default" : "outline"} size={mode === "create" ? "default" : "sm"}>
          {mode === "create" ? "Add service" : "Edit"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add service" : "Edit service"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {mode === "edit" && service && <input type="hidden" name="serviceId" value={service.id} />}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`name-${idSuffix}`}>Name</Label>
            <Input
              id={`name-${idSuffix}`}
              name="name"
              required
              defaultValue={service?.name}
              aria-invalid={!!fieldErrors.name}
            />
            {fieldErrors.name?.map((msg) => (
              <p key={msg} className="text-sm text-destructive">
                {msg}
              </p>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`durationMin-${idSuffix}`}>Duration (minutes)</Label>
            <Input
              id={`durationMin-${idSuffix}`}
              name="durationMin"
              type="number"
              min={1}
              required
              defaultValue={service?.durationMin}
              aria-invalid={!!fieldErrors.durationMin}
            />
            {fieldErrors.durationMin?.map((msg) => (
              <p key={msg} className="text-sm text-destructive">
                {msg}
              </p>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`pricePhp-${idSuffix}`}>Price (₱)</Label>
            <Input
              id={`pricePhp-${idSuffix}`}
              name="pricePhp"
              type="number"
              min={0}
              required
              defaultValue={service?.pricePhp}
              aria-invalid={!!fieldErrors.pricePhp}
            />
            {fieldErrors.pricePhp?.map((msg) => (
              <p key={msg} className="text-sm text-destructive">
                {msg}
              </p>
            ))}
          </div>

          {state.status === "invalid" && Object.keys(fieldErrors).length === 0 && (
            <Alert variant="destructive">
              <AlertDescription>Please check your entry and try again.</AlertDescription>
            </Alert>
          )}

          <SubmitButton label="Save" pendingLabel="Saving..." className="w-full" />
        </form>
      </DialogContent>
    </Dialog>
  );
}
