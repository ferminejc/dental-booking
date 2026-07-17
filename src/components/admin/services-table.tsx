import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { setServiceActiveAction } from "@/lib/admin-actions";
import type { AdminServiceRow } from "@/lib/admin-queries";
import { ServiceForm } from "./service-form";

function formatPrice(pricePhp: number): string {
  return `₱${pricePhp.toLocaleString("en-PH")}`;
}

export function ServicesTable({ rows }: { rows: AdminServiceRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No services yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium text-foreground">{row.name}</TableCell>
            <TableCell>{row.durationMin} min</TableCell>
            <TableCell>{formatPrice(row.pricePhp)}</TableCell>
            <TableCell>
              <Badge variant={row.active ? "default" : "secondary"}>{row.active ? "Active" : "Inactive"}</Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <ServiceForm mode="edit" service={row} />
                <form action={setServiceActiveAction}>
                  <input type="hidden" name="serviceId" value={row.id} />
                  <input type="hidden" name="active" value={(!row.active).toString()} />
                  <Button type="submit" variant="outline" size="sm">
                    {row.active ? "Deactivate" : "Reactivate"}
                  </Button>
                </form>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
