import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatMVR, cn } from "@/lib/utils";

export interface ReconRow {
  id: string;
  name: string;
  isCash: boolean;
  isCredit: boolean;
  opening: number;
  received: number;
  expected: number;
  /** Only once the session is closed. */
  counted?: number | null;
  difference?: number | null;
}

function money(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Ewity-style per-payment-type table: Opening / Received / Expected (+ Closing / Difference once closed). */
export function ReconciliationTable({ rows, showClosing }: { rows: ReconRow[]; showClosing: boolean }) {
  const collected = rows.filter((r) => !r.isCredit);
  const onCredit = rows.filter((r) => r.isCredit && r.received > 0);

  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Opening</TableHead>
            <TableHead className="text-right">Received</TableHead>
            <TableHead className="text-right">Expected</TableHead>
            {showClosing && <TableHead className="text-right">Closing</TableHead>}
            {showClosing && <TableHead className="text-right">Difference</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {collected.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell className="text-right tabular-nums">{money(r.opening)}</TableCell>
              <TableCell className="text-right tabular-nums">{money(r.received)}</TableCell>
              <TableCell className="text-right tabular-nums">{money(r.expected)}</TableCell>
              {showClosing && (
                <TableCell className="text-right tabular-nums">{r.counted == null ? "—" : money(r.counted)}</TableCell>
              )}
              {showClosing && (
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    r.difference == null || Math.abs(r.difference) < 0.005
                      ? "text-muted-foreground"
                      : r.difference < 0
                        ? "font-semibold text-destructive"
                        : "font-semibold text-success"
                  )}
                >
                  {r.difference == null ? "—" : money(r.difference)}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {onCredit.length > 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          Sold on credit (no money collected, so not counted above):{" "}
          {onCredit.map((r) => `${r.name} ${formatMVR(r.received)}`).join(", ")}
        </p>
      )}
    </div>
  );
}
