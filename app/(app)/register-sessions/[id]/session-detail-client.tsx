"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { PrintButton } from "@/components/shared/print-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ReconciliationTable, type ReconRow } from "@/components/register/reconciliation-table";
import { CloseRegisterDialog } from "@/components/register/close-register-dialog";
import { formatMVR, formatMaldivesDateTime } from "@/lib/utils";
import { DENOMINATIONS, denominationsTotal, formatDuration } from "@/lib/register";
import type { CashRegister, CashRegisterTransaction, RegisterSummaryRow } from "@/types/database";
import { ArrowLeft, Lock } from "lucide-react";

export interface SessionPayment {
  id: string;
  orderId: string;
  orderNumber: string;
  methodId: string;
  method: string;
  amount: number;
  createdAt: string;
}

function Denoms({ title, value }: { title: string; value: Record<string, number> | null }) {
  if (!value || Object.keys(value).length === 0) return null;
  return (
    <div className="text-sm">
      <p className="mb-1 font-medium">{title}</p>
      <p className="text-muted-foreground">
        {DENOMINATIONS.filter((d) => value[String(d)]).map((d) => `Rf ${d} × ${value[String(d)]}`).join(" · ")}
        {" = "}
        {formatMVR(denominationsTotal(value))}
      </p>
    </div>
  );
}

function InfoRows({ s, cashierName, closedByName }: { s: CashRegister; cashierName: string; closedByName: string | null }) {
  const rows: [string, string][] = [
    ["Session", `#${s.session_no}`],
    ["Cashier", cashierName],
    ["Opened", formatMaldivesDateTime(s.opened_at)],
    ["Closed", s.closed_at ? `${formatMaldivesDateTime(s.closed_at)}${closedByName ? ` by ${closedByName}` : ""}` : "Still open"],
    ["Duration", formatDuration(s.opened_at, s.closed_at)],
    ["Opening notes", s.opening_notes || "—"],
    ["Closing notes", s.closing_notes || "—"],
  ];
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 border-b py-1.5">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-right font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function CashTable({ transactions }: { transactions: CashRegisterTransaction[] }) {
  if (transactions.length === 0) return <p className="p-6 text-center text-sm text-muted-foreground">No cash in / out recorded.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((t) => (
          <TableRow key={t.id}>
            <TableCell>{formatMaldivesDateTime(t.created_at)}</TableCell>
            <TableCell>{t.type === "cash_in" ? "Cash in" : "Cash out"}</TableCell>
            <TableCell>{t.reason ?? "—"}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMVR(t.amount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PaymentsTable({ payments, link }: { payments: SessionPayment[]; link: boolean }) {
  if (payments.length === 0) return <p className="p-6 text-center text-sm text-muted-foreground">No payments.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Method</TableHead>
          <TableHead>Time</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((p) => (
          <TableRow key={p.id}>
            <TableCell>{link ? <Link className="font-medium underline-offset-2 hover:underline" href={`/orders/${p.orderId}`}>{p.orderNumber}</Link> : p.orderNumber}</TableCell>
            <TableCell>{p.method}</TableCell>
            <TableCell>{formatMaldivesDateTime(p.createdAt)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMVR(p.amount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function SessionDetailClient({
  session,
  cashierName,
  closedByName,
  rows,
  summary,
  transactions,
  payments,
}: {
  session: CashRegister;
  cashierName: string;
  closedByName: string | null;
  rows: ReconRow[];
  summary: RegisterSummaryRow[];
  transactions: CashRegisterTransaction[];
  payments: SessionPayment[];
}) {
  const router = useRouter();
  const [closeOpen, setCloseOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const isOpen = session.status === "open";

  const methodOptions = useMemo(() => Array.from(new Map(payments.map((p) => [p.methodId, p.method])).entries()), [payments]);
  const filtered = filter === "all" ? payments : payments.filter((p) => p.methodId === filter);

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title={`Session #${session.session_no}`}
          description={`${cashierName} · ${isOpen ? "open" : "closed"}`}
          actions={
            <>
              <Button asChild variant="outline" className="gap-1.5">
                <Link href="/register-sessions"><ArrowLeft className="h-4 w-4" /> All sessions</Link>
              </Button>
              <PrintButton label="Print / PDF" />
              {isOpen && (
                <Button variant="destructive" className="gap-1.5" onClick={() => setCloseOpen(true)}>
                  <Lock className="h-4 w-4" /> Close session
                </Button>
              )}
            </>
          }
        />
      </div>

      {/* On screen: tabs */}
      <div className="no-print space-y-4 p-4 sm:p-6">
        <Tabs defaultValue="info">
          <TabsList>
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="cash">Cash in / out</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Session</CardTitle>
                <Badge variant={isOpen ? "success" : "secondary"}>{isOpen ? "Open" : "Closed"}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoRows s={session} cashierName={cashierName} closedByName={closedByName} />
                <Denoms title="Opening count" value={session.opening_denominations} />
                <Denoms title="Closing count" value={session.closing_denominations} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{isOpen ? "Live figures" : "Reconciliation"}</CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-0">
                <ReconciliationTable rows={rows} showClosing={!isOpen} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="cash">
            <Card><CardContent className="p-0 sm:p-0"><CashTable transactions={transactions} /></CardContent></Card>
          </TabsContent>
          <TabsContent value="payments" className="space-y-3">
            <div className="max-w-xs">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger><SelectValue placeholder="All payment types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All payment types</SelectItem>
                  {methodOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Card><CardContent className="p-0 sm:p-0"><PaymentsTable payments={filtered} link /></CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Print / PDF: the whole report on one page */}
      <div id="session-print-area" className="hidden space-y-5 p-6 print:block">
        <h1 className="text-xl font-semibold">Register session #{session.session_no}</h1>
        <InfoRows s={session} cashierName={cashierName} closedByName={closedByName} />
        <Denoms title="Opening count" value={session.opening_denominations} />
        <Denoms title="Closing count" value={session.closing_denominations} />
        <h2 className="font-semibold">{isOpen ? "Live figures" : "Reconciliation"}</h2>
        <ReconciliationTable rows={rows} showClosing={!isOpen} />
        <h2 className="font-semibold">Cash in / out</h2>
        <CashTable transactions={transactions} />
        <h2 className="font-semibold">Payments</h2>
        <PaymentsTable payments={payments} link={false} />
      </div>

      {isOpen && (
        <CloseRegisterDialog
          open={closeOpen}
          onOpenChange={setCloseOpen}
          registerId={session.id}
          summary={summary}
          closingForName={cashierName}
          onClosed={() => router.refresh()}
        />
      )}
    </div>
  );
}
