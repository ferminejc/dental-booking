import Link from "next/link";
import { db } from "@/db/client";
import { AppointmentTable } from "@/components/admin/appointment-table";
import { AppointmentWeekGrid } from "@/components/admin/appointment-week-grid";
import { StatusFilter } from "@/components/admin/status-filter";
import { buttonVariants } from "@/components/ui/button";
import { getAppointmentsInRange } from "@/lib/admin-queries";
import type { AppointmentStatus } from "@/lib/slots";
import {
  addDaysToManilaDate,
  formatDateLabel,
  manilaDateTimeToUtc,
  mondayOfManilaWeek,
  utcToManilaDateString,
} from "@/lib/timezone";
import { cn } from "@/lib/utils";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUSES = new Set<AppointmentStatus>(["pending", "confirmed", "completed", "cancelled", "no_show"]);

function ViewToggle({ view }: { view: "list" | "week" }) {
  return (
    <div className="flex gap-1">
      <Link href="/admin?view=list" className={cn(buttonVariants({ variant: view === "list" ? "default" : "outline", size: "sm" }))}>
        List
      </Link>
      <Link href="/admin?view=week" className={cn(buttonVariants({ variant: view === "week" ? "default" : "outline", size: "sm" }))}>
        Week
      </Link>
    </div>
  );
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; week?: string; status?: string }>;
}) {
  const params = await searchParams;
  const view = params.view === "week" ? "week" : "list";
  const today = utcToManilaDateString(new Date());

  if (view === "week") {
    const weekStart = params.week && DATE_REGEX.test(params.week) ? params.week : mondayOfManilaWeek(today);
    const startUtc = manilaDateTimeToUtc(weekStart, "00:00");
    const endUtc = manilaDateTimeToUtc(addDaysToManilaDate(weekStart, 7), "00:00");
    const rows = await getAppointmentsInRange(db, { startUtc, endUtc });
    const prevWeek = addDaysToManilaDate(weekStart, -7);
    const nextWeek = addDaysToManilaDate(weekStart, 7);

    return (
      <div className="flex flex-col gap-4">
        <ViewToggle view="week" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-foreground">Week of {formatDateLabel(weekStart)}</h1>
          <div className="flex gap-2">
            <Link href={`/admin?view=week&week=${prevWeek}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              ← Prev week
            </Link>
            <Link href={`/admin?view=week&week=${nextWeek}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Next week →
            </Link>
          </div>
        </div>
        <AppointmentWeekGrid rows={rows} weekStart={weekStart} />
      </div>
    );
  }

  const date = params.date && DATE_REGEX.test(params.date) ? params.date : today;
  const statusFilter =
    params.status && VALID_STATUSES.has(params.status as AppointmentStatus)
      ? (params.status as AppointmentStatus)
      : undefined;
  const startUtc = manilaDateTimeToUtc(date, "00:00");
  const endUtc = manilaDateTimeToUtc(addDaysToManilaDate(date, 1), "00:00");
  const rows = await getAppointmentsInRange(db, {
    startUtc,
    endUtc,
    statuses: statusFilter ? [statusFilter] : undefined,
  });
  const prevDate = addDaysToManilaDate(date, -1);
  const nextDate = addDaysToManilaDate(date, 1);

  return (
    <div className="flex flex-col gap-4">
      <ViewToggle view="list" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-foreground">{formatDateLabel(date)}</h1>
        <div className="flex items-center gap-2">
          <StatusFilter value={statusFilter ?? "all"} />
          <Link href={`/admin?view=list&date=${prevDate}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            ← Prev day
          </Link>
          <Link href={`/admin?view=list&date=${nextDate}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Next day →
          </Link>
          {date !== today && (
            <Link href="/admin?view=list" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Today
            </Link>
          )}
        </div>
      </div>
      <AppointmentTable rows={rows} />
    </div>
  );
}
