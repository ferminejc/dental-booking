import { db } from "@/db/client";
import { ServiceForm } from "@/components/admin/service-form";
import { ServicesTable } from "@/components/admin/services-table";
import { getAllServices } from "@/lib/admin-queries";

export default async function ServicesPage() {
  const rows = await getAllServices(db);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Services</h1>
        <ServiceForm mode="create" />
      </div>
      <ServicesTable rows={rows} />
    </div>
  );
}
