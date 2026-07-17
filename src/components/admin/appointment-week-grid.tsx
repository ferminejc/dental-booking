import { Badge } from "@/components/ui/badge";
import type { AdminAppointmentRow } from "@/lib/admin-queries";
import type { AppointmentStatus } from "@/lib/slots";
import {
  addDaysToManilaDate,
  formatDateLabel,
  formatTimeLabel,
  utcToManilaDateString,
  utcToManilaTimeString,
  type ManilaDateString,
} from "@/lib/timezone";

const STATUS_BADGE_VARIANT: Record<AppointmentStatus, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  confirmed: "default",
  completed: "outline",
  cancelled: "destructive",
  no_show: "destructive",
};

// Read-only glance at the week — status-changing actions live only in the
// list view, keeping these columns narrow and this view purpose-distinct.
export function AppointmentWeekGrid({
  rows,
  weekStart,
}: {
  rows: AdminAppointmentRow[];
  weekStart: ManilaDateString;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysToManilaDate(weekStart, i));
  const byDate = new Map<ManilaDateString, AdminAppointmentRow[]>(days.map((d) => [d, []]));
  for (const row of rows) {
    byDate.get(utcToManilaDateString(row.startsAt))?.push(row);
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((day) => {
        const dayRows = byDate.get(day) ?? [];
        return (
          <div key={day} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <h3 className="text-sm font-medium text-foreground">{formatDateLabel(day)}</h3>
            {dayRows.length === 0 ? (
              <p className="text-xs text-muted-foreground">No appointments</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {dayRows.map((row) => (
                  <li key={row.id} className="flex flex-col gap-0.5 text-xs">
                    <span className="font-medium text-foreground">
                      {formatTimeLabel(utcToManilaTimeString(row.startsAt))}
                    </span>
                    <span className="text-muted-foreground">{row.patientName}</span>
                    <span className="text-muted-foreground">{row.serviceName}</span>
                    <Badge variant={STATUS_BADGE_VARIANT[row.status]} className="w-fit">
                      {row.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
