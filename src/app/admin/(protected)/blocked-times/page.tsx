import { db } from "@/db/client";
import { BlockedTimeForm } from "@/components/admin/blocked-time-form";
import { BlockedTimeList } from "@/components/admin/blocked-time-list";
import { getAllBlockedTimes } from "@/lib/admin-queries";

export default async function BlockedTimesPage() {
  const rows = await getAllBlockedTimes(db);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-foreground">Blocked Times</h1>
      <BlockedTimeForm />
      <BlockedTimeList rows={rows} />
    </div>
  );
}
