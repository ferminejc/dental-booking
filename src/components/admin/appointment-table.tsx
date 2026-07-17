import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminAppointmentRow } from "@/lib/admin-queries";
import { validAppointmentTransitions } from "@/lib/admin-repo";
import type { AppointmentStatus } from "@/lib/slots";
import { formatTimeLabel, utcToManilaTimeString } from "@/lib/timezone";
import { AppointmentStatusMenu } from "./appointment-status-menu";

const STATUS_BADGE_VARIANT: Record<AppointmentStatus, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  confirmed: "default",
  completed: "outline",
  cancelled: "destructive",
  no_show: "destructive",
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export function AppointmentTable({ rows }: { rows: AdminAppointmentRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No appointments for this day.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Patient</TableHead>
          <TableHead>Service</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="whitespace-nowrap">
              {formatTimeLabel(utcToManilaTimeString(row.startsAt))} –{" "}
              {formatTimeLabel(utcToManilaTimeString(row.endsAt))}
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{row.patientName}</span>
                <a
                  href={`tel:${row.patientMobile}`}
                  className="text-sm text-muted-foreground underline underline-offset-2"
                >
                  {row.patientMobile}
                </a>
                <span className="font-mono text-xs text-muted-foreground">{row.refCode}</span>
              </div>
            </TableCell>
            <TableCell>
              {row.serviceName}
              <span className="block text-xs text-muted-foreground">{row.serviceDurationMin} min</span>
            </TableCell>
            <TableCell>
              <Badge variant={STATUS_BADGE_VARIANT[row.status]}>{STATUS_LABELS[row.status]}</Badge>
            </TableCell>
            <TableCell className="text-right">
              <AppointmentStatusMenu appointmentId={row.id} validTargets={validAppointmentTransitions(row.status)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
