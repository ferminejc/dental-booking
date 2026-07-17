"use client";

import { useActionState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { updateAppointmentStatusAction, type UpdateAppointmentStatusState } from "@/lib/admin-actions";
import type { AppointmentStatus } from "@/lib/slots";

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

const initialState: UpdateAppointmentStatusState = { status: "idle" };

export function AppointmentStatusMenu({
  appointmentId,
  validTargets,
}: {
  appointmentId: string;
  validTargets: AppointmentStatus[];
}) {
  const [state, formAction] = useActionState(updateAppointmentStatusAction, initialState);

  if (validTargets.length === 0) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            Change status
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <form action={formAction}>
            <input type="hidden" name="appointmentId" value={appointmentId} />
            {validTargets.map((target) => (
              <DropdownMenuItem key={target} asChild>
                <button type="submit" name="newStatus" value={target} className="w-full text-left">
                  Mark as {STATUS_LABELS[target]}
                </button>
              </DropdownMenuItem>
            ))}
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
      {state.status === "invalid_transition" && <p className="text-xs text-destructive">{state.message}</p>}
      {state.status === "not_found" && (
        <p className="text-xs text-destructive">Appointment not found — try refreshing.</p>
      )}
    </div>
  );
}
