import { db } from "@/db/client";
import { ClinicHoursForm } from "@/components/admin/clinic-hours-form";
import { getClinicSettings } from "@/lib/booking-queries";

export default async function ClinicHoursPage() {
  const settings = await getClinicSettings(db);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Clinic Hours</h1>
        <p className="text-sm text-muted-foreground">These hours control what slots patients can book.</p>
      </div>
      <ClinicHoursForm initialHours={settings.openHours} />
    </div>
  );
}
