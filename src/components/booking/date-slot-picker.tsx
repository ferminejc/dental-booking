import Link from "next/link";
import { db } from "@/db/client";
import { getAvailableDatesForService, getSlotsForDate } from "@/lib/booking-queries";
import { formatDateLabel, formatTimeLabel, manilaTimeToUrlSegment, utcToManilaTimeString } from "@/lib/timezone";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ServiceSummary {
  id: string;
  name: string;
  durationMin: number;
  pricePhp: number;
}

export async function DateSlotPicker({
  service,
  selectedDate,
}: {
  service: ServiceSummary;
  selectedDate?: string;
}) {
  const now = new Date();
  const dates = await getAvailableDatesForService(db, {
    serviceDurationMinutes: service.durationMin,
    now,
  });

  const slots = selectedDate
    ? await getSlotsForDate(db, { serviceDurationMinutes: service.durationMin, date: selectedDate, now })
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{service.name}</h1>
        <p className="text-sm text-muted-foreground">
          {service.durationMin} min · ₱{service.pricePhp.toLocaleString("en-PH")}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Pick a date</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {dates.map((d) => {
            const label = formatDateLabel(d.date);
            if (!d.available) {
              return (
                <div
                  key={d.date}
                  aria-disabled="true"
                  className="flex h-14 min-w-20 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-border px-2 text-center text-sm text-muted-foreground opacity-40"
                >
                  {label}
                </div>
              );
            }
            return (
              <Link
                key={d.date}
                href={`/book/${service.id}/${d.date}`}
                className={cn(
                  buttonVariants({ variant: d.date === selectedDate ? "default" : "outline" }),
                  "h-14 min-w-20 shrink-0 flex-col gap-0.5 whitespace-normal px-2 text-sm",
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>

      {selectedDate && slots && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Pick a time — {formatDateLabel(selectedDate)}
          </h2>
          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open slots this day. Try another date.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => {
                const time = utcToManilaTimeString(slot.start);
                return (
                  <Link
                    key={time}
                    href={`/book/${service.id}/${selectedDate}/${manilaTimeToUrlSegment(time)}`}
                    className={cn(buttonVariants({ variant: "outline" }), "h-12 text-base")}
                  >
                    {formatTimeLabel(time)}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
