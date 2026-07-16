import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { getServiceById } from "@/lib/booking-queries";
import { manilaTimeFromUrlSegment } from "@/lib/timezone";
import { BookingForm } from "@/components/booking/booking-form";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_SEGMENT_REGEX = /^\d{4}$/;

export default async function BookServiceDateTimePage({
  params,
}: {
  params: Promise<{ serviceId: string; date: string; time: string }>;
}) {
  const { serviceId, date, time: timeSegment } = await params;
  if (!DATE_REGEX.test(date) || !TIME_SEGMENT_REGEX.test(timeSegment)) notFound();

  const service = await getServiceById(db, serviceId);
  if (!service || !service.active) notFound();

  const time = manilaTimeFromUrlSegment(timeSegment);

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <Link
          href={`/book/${serviceId}/${date}`}
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          ← Back to time picker
        </Link>
        <BookingForm service={service} date={date} time={time} />
      </div>
    </div>
  );
}
