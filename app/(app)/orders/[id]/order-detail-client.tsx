"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Receipt } from "@/components/pos/receipt";
import { formatMVR, formatMaldivesDateTime, round2 } from "@/lib/utils";
import type { BusinessSettings } from "@/types/database";
import type { ReceiptData } from "@/lib/pos/types";
import { Loader2, Printer, Ban, Undo2 } from "lucide-react";

interface OrderItemRow {
  id: string;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  item_discount_amount: number;
  tax_amount: number;
  line_total: number;
  notes: string | null;
}

interface OrderFull {
  id: string;
  order_number: string;
  created_at: string;
  order_type: string;
  status: string;
  voided: boolean;
  voided_reason: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  sync_status: string;
  cashier: { full_name: string } | null;
  customer: { full_name: string; phone: string | null } | null;
  order_items: OrderItemRow[];
  payments: { id: string; amount: number; amount_received: number | null; change_amount: number; reference: string | null; payment_method: { name: string; code: string } | null }[];
}

export function OrderDetailClient({
  order,
  canManage,
  refundItems,
  businessSettings,
  taxName,
}: {
  order: OrderFull;
  canManage: boolean;
  refundItems: { order_item_id: string; quantity: number }[];
  businessSettings: BusinessSettings | null;
  taxName: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundQtys, setRefundQtys] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);

  const refundedByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of refundItems) map.set(r.order_item_id, (map.get(r.order_item_id) ?? 0) + Number(r.quantity));
    return map;
  }, [refundItems]);

  async function handleVoid() {
    if (!voidReason.trim()) {
      toast.error("A reason is required to void an order.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("void_order", { p_order_id: order.id, p_reason: voidReason.trim() });
    setSubmitting(false);
    if (error) {
      toast.error("Unable to void this order. Please try again.");
      return;
    }
    toast.success("Order voided.");
    setVoidOpen(false);
    router.refresh();
  }

  const refundLines = order.order_items.map((item) => {
    const alreadyRefunded = refundedByItem.get(item.id) ?? 0;
    const remaining = Math.max(item.quantity - alreadyRefunded, 0);
    const discountPerUnit = item.quantity > 0 ? item.item_discount_amount / item.quantity : 0;
    const qty = Math.min(Number(refundQtys[item.id] ?? 0) || 0, remaining);
    // Refund math: (unit price - per-unit discount already applied) × quantity being refunded.
    const refundAmount = round2((item.unit_price - discountPerUnit) * qty);
    return { item, alreadyRefunded, remaining, discountPerUnit, qty, refundAmount };
  });
  const refundTotal = round2(refundLines.reduce((s, l) => s + l.refundAmount, 0));

  async function handleRefund() {
    if (!refundReason.trim()) {
      toast.error("A reason is required to process a refund.");
      return;
    }
    const items = refundLines.filter((l) => l.qty > 0).map((l) => ({ order_item_id: l.item.id, quantity: l.qty, refund_amount: l.refundAmount }));
    if (items.length === 0) {
      toast.error("Choose at least one item and quantity to refund.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("process_refund", { p_order_id: order.id, p_reason: refundReason.trim(), p_items: items });
    setSubmitting(false);
    if (error) {
      toast.error("Unable to process this refund. Please try again.");
      return;
    }
    toast.success("Refund processed.");
    setRefundOpen(false);
    setRefundQtys({});
    setRefundReason("");
    router.refresh();
  }

  const receiptData: ReceiptData = {
    orderNumber: order.order_number,
    createdAt: order.created_at,
    cashierName: order.cashier?.full_name ?? "—",
    orderType: order.order_type as ReceiptData["orderType"],
    notes: order.notes,
    items: order.order_items.map((i) => ({
      productName: i.product_name,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      itemDiscountAmount: i.item_discount_amount,
      lineTotal: i.line_total,
    })),
    subtotal: order.subtotal,
    discountAmount: order.discount_amount,
    taxAmount: order.tax_amount,
    taxName,
    total: order.total,
    payments: order.payments.map((p) => ({
      methodName: p.payment_method?.name ?? "Payment",
      amount: p.amount,
      amountReceived: p.amount_received,
      changeAmount: p.change_amount,
    })),
    syncStatus: order.sync_status as ReceiptData["syncStatus"],
  };

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <PageHeader
        title={order.order_number}
        description={formatMaldivesDateTime(order.created_at)}
        actions={
          <>
            <Button variant="outline" className="gap-1.5" onClick={() => setReceiptPreviewOpen(true)}>
              <Printer className="h-4 w-4" /> Reprint receipt
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/orders/${order.id}/receipt`}>Open receipt page</Link>
            </Button>
            {canManage && !order.voided && (
              <>
                <Button variant="outline" className="gap-1.5" onClick={() => setRefundOpen(true)}>
                  <Undo2 className="h-4 w-4" /> Refund
                </Button>
                <Button variant="destructive" className="gap-1.5" onClick={() => setVoidOpen(true)}>
                  <Ban className="h-4 w-4" /> Void
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="flex flex-wrap gap-2 px-4 sm:px-6">
        {order.voided ? <Badge variant="destructive">Voided{order.voided_reason ? `: ${order.voided_reason}` : ""}</Badge> : <Badge variant="success" className="capitalize">{order.status}</Badge>}
        {order.sync_status === "pending" && <Badge variant="warning">Pending Sync</Badge>}
        {order.sync_status === "failed" && <Badge variant="destructive">Sync Failed</Badge>}
        <Badge variant="outline" className="capitalize">{order.order_type.replace("_", " ")}</Badge>
        {order.cashier && <Badge variant="outline">Cashier: {order.cashier.full_name}</Badge>}
        {order.customer && <Badge variant="outline">Customer: {order.customer.full_name}</Badge>}
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 sm:px-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.order_items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium">{item.product_name}</p>
                      {item.notes && <p className="text-xs italic text-muted-foreground">“{item.notes}”</p>}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatMVR(item.unit_price)}</TableCell>
                    <TableCell className="text-right">{item.item_discount_amount > 0 ? `-${formatMVR(item.item_discount_amount)}` : "—"}</TableCell>
                    <TableCell className="text-right">{item.tax_amount > 0 ? formatMVR(item.tax_amount) : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{formatMVR(item.line_total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatMVR(order.subtotal)}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Discount</span>
                  <span>-{formatMVR(order.discount_amount)}</span>
                </div>
              )}
              {order.tax_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatMVR(order.tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 text-base font-semibold">
                <span>Total</span>
                <span>{formatMVR(order.total)}</span>
              </div>
              {order.notes && <p className="pt-2 text-xs italic text-muted-foreground">Note: {order.notes}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {order.payments.map((p) => (
                <div key={p.id} className="flex justify-between">
                  <span>{p.payment_method?.name ?? "Payment"}{p.reference ? ` (${p.reference})` : ""}</span>
                  <span>{formatMVR(p.amount)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Void dialog */}
      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void order {order.order_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="void-reason">Reason</Label>
            <textarea
              id="void-reason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Why is this order being voided?"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleVoid} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Void order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund dialog */}
      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Refund order {order.order_number}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[40vh] space-y-3 overflow-y-auto">
            {refundLines.map(({ item, remaining }) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMVR(item.unit_price)} each · {remaining} of {item.quantity} refundable
                  </p>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={remaining}
                  step="1"
                  className="w-20"
                  disabled={remaining === 0}
                  value={refundQtys[item.id] ?? ""}
                  onChange={(e) => setRefundQtys((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="refund-reason">Reason</Label>
            <textarea
              id="refund-reason"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Why is this being refunded?"
            />
          </div>
          <div className="flex justify-between rounded-lg bg-muted p-3 text-sm font-semibold">
            <span>Refund total</span>
            <span>{formatMVR(refundTotal)}</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRefund} disabled={submitting || refundTotal <= 0}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Process refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reprint preview */}
      <Dialog open={receiptPreviewOpen} onOpenChange={setReceiptPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
          </DialogHeader>
          {businessSettings && <Receipt data={receiptData} business={businessSettings} />}
          <div className="no-print">
            <Button className="w-full gap-1.5" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
