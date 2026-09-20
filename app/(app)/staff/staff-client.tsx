"use client";

import { PageHeader } from "@/components/shared/page-header";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMVR } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv-export";
import type { StaffRow } from "./page";
import { Download, UserCog } from "lucide-react";

export function StaffClient({ rows, from, to }: { rows: StaffRow[]; from: string; to: string }) {
  const relevant = rows.filter((r) => r.orderCount > 0 || r.refunds > 0 || r.registerDifference !== 0);

  return (
    <div>
      <PageHeader title="Staff Report" description="Per-staff sales, discounts, refunds and register differences for the selected range." />

      <div className="space-y-4 p-4 sm:p-6">
        <Card className="p-4">
          <DateRangePicker from={from} to={to} />
        </Card>

        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv(`staff-report-${from}-to-${to}`, rows, [
                { header: "Staff", accessor: (r) => r.fullName },
                { header: "Role", accessor: (r) => r.role },
                { header: "Orders", accessor: (r) => r.orderCount },
                { header: "Total sales", accessor: (r) => r.totalSales.toFixed(2) },
                { header: "Discounts given", accessor: (r) => r.discounts.toFixed(2) },
                { header: "Refunds processed", accessor: (r) => r.refunds.toFixed(2) },
                { header: "Register difference", accessor: (r) => r.registerDifference.toFixed(2) },
              ])
            }
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={UserCog} title="No staff found" />
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Total sales</TableHead>
                  <TableHead className="text-right">Discounts given</TableHead>
                  <TableHead className="text-right">Refunds</TableHead>
                  <TableHead className="text-right">Register diff.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.profileId}>
                    <TableCell className="font-medium">{r.fullName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {r.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{r.orderCount}</TableCell>
                    <TableCell className="text-right font-medium">{formatMVR(r.totalSales)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatMVR(r.discounts)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatMVR(r.refunds)}</TableCell>
                    <TableCell
                      className={
                        "text-right " +
                        (r.registerDifference < 0 ? "text-destructive" : r.registerDifference > 0 ? "text-warning" : "")
                      }
                    >
                      {formatMVR(r.registerDifference)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
        {relevant.length === 0 && rows.length > 0 && (
          <p className="text-xs text-muted-foreground">No activity recorded for any staff member in this range.</p>
        )}
      </div>
    </div>
  );
}
