import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BlockedTimeRow } from "@/lib/admin-queries";
import { deleteBlockedTimeAction } from "@/lib/admin-actions";
import { formatDateLabel, formatTimeLabel, utcToManilaDateString, utcToManilaTimeString } from "@/lib/timezone";

export function BlockedTimeList({ rows }: { rows: BlockedTimeRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No blocked times.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>From</TableHead>
          <TableHead>To</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="whitespace-nowrap">
              {formatDateLabel(utcToManilaDateString(row.startsAt))} {formatTimeLabel(utcToManilaTimeString(row.startsAt))}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {formatDateLabel(utcToManilaDateString(row.endsAt))} {formatTimeLabel(utcToManilaTimeString(row.endsAt))}
            </TableCell>
            <TableCell className="text-muted-foreground">{row.reason ?? "—"}</TableCell>
            <TableCell className="text-right">
              <form action={deleteBlockedTimeAction}>
                <input type="hidden" name="id" value={row.id} />
                <Button type="submit" variant="outline" size="sm">
                  Delete
                </Button>
              </form>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
