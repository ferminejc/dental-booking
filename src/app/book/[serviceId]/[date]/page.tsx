import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { getServiceById } from "@/lib/booking-queries";
import { DateSlotPicker } from "@/components/booking/date-slot-picker";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export default async function BookServiceDatePage({
  params,
}: {
  params: Promise<{ serviceId: string; date: string }>;
}) {
  const { serviceId, date } = await params;
  if (!DATE_REGEX.test(date)) notFound();

  const service = await getServiceById(db, serviceId);
  if (!service || !service.active) notFound();

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <Link
          href="/"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          ← All services
        </Link>
        <DateSlotPicker service={service} selectedDate={date} />
      </div>
    </div>
  );
}
