"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Customer, CreditSettlement, Order, PaymentMethod } from "@/types/database";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatMVR, formatMaldivesDateTime, round2 } from "@/lib/utils";
import { Receipt, Loader2, Wallet, HandCoins } from "lucide-react";
import { toast } from "sonner";

export function CustomerDetailDialog({
  customer,
  onOpenChange,
  balance,
  paymentMethods,
  onSettled,
}: {
  customer: Customer | null;
  onOpenChange: (open: boolean) => void;
  balance: number;
  paymentMethods: PaymentMethod[];
  onSettled: () => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [settlements, setSettlements] = useState<CreditSettlement[]>([]);
  const [loading, setLoading] = useState(false);

  const [settleOpen, setSettleOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleMethodId, setSettleMethodId] = useState<string | null>(null);
  const [settleReference, setSettleReference] = useState("");
  const [settling, setSettling] = useState(false);

  // A customer can't settle credit with the Credit method itself.
  const settleMethods = paymentMethods.filter((m) => !m.code.startsWith("credit"));

  useEffect(() => {
    if (!customer) return;
    let cancelled = false;
    setLoading(true);
    const supabase = createClient();
    Promise.all([
      supabase.from("orders").select("*").eq("customer_id", customer.id).order("created_at", { ascending: false }),
      supabase.from("credit_settlements").select("*").eq("customer_id", customer.id).order("created_at", { ascending: false }),
    ]).then(([ordersRes, settlementsRes]) => {
      if (!cancelled) {
        setOrders((ordersRes.data ?? []) as Order[]);
        setSettlements((settlementsRes.data ?? []) as CreditSettlement[]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [customer]);

  useEffect(() => {
    if (settleOpen) {
      setSettleAmount(balance.toFixed(2));
      setSettleMethodId(settleMethods[0]?.id ?? null);
      setSettleReference("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settleOpen]);

  const validOrders = orders.filter((o) => !o.voided);
  const totalSpent = validOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const lastOrder = orders[0];

  async function handleSettle() {
    if (!customer) return;
    const amount = round2(Number(settleAmount) || 0);
    if (amount <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    if (amount > balance + 0.01) {
      toast.error("Amount can't be more than the outstanding balance.");
      return;
    }
    if (!settleMethodId) {
      toast.error("Choose how the customer paid.");
      return;
    }
    setSettling(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("settle_credit", {
      p_customer_id: customer.id,
      p_amount: amount,
      p_payment_method_id: settleMethodId,
      p_reference: settleReference.trim() || null,
      p_notes: null,
    });
    setSettling(false);
    if (error) {
      toast.error(error.message || "Unable to record this payment.");
      return;
    }
    toast.success("Payment recorded.");
    setSettleOpen(false);
    onSettled();
    // Refresh this dialog's own settlement list.
    const { data } = await supabase
      .from("credit_settlements")
      .select("*")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });
    setSettlements((data ?? []) as CreditSettlement[]);
  }

  return (
    <>
    <Dialog open={!!customer} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{customer?.full_name}</DialogTitle>
          <DialogDescription>
            {customer?.phone || "No phone"} {customer?.address ? `· ${customer.address}` : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Total orders" value={String(validOrders.length)} />
              <StatCard label="Total spent" value={formatMVR(totalSpent)} />
              <StatCard label="Last order" value={lastOrder ? formatMaldivesDateTime(lastOrder.created_at) : "—"} />
              <StatCard
                label="Credit owed"
                value={formatMVR(balance)}
                icon={Wallet}
                tone={balance > 0 ? "warning" : "default"}
              />
            </div>

            {balance > 0 && (
              <Button className="w-full gap-1.5" onClick={() => setSettleOpen(true)}>
                <HandCoins className="h-4 w-4" /> Record a payment towards this balance
              </Button>
            )}

            {customer?.notes && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">{customer.notes}</div>
            )}

            {settlements.length > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-medium">Credit payments</p>
                <ul className="space-y-1.5">
                  {settlements.map((s) => (
                    <li key={s.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <div>
                        <p>{formatMVR(s.amount)}</p>
                        <p className="text-xs text-muted-foreground">{formatMaldivesDateTime(s.created_at)}</p>
                      </div>
                      {s.reference && <p className="text-xs text-muted-foreground">{s.reference}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {orders.length === 0 ? (
              <EmptyState icon={Receipt} title="No orders yet" description="This customer hasn't placed any orders." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>{formatMaldivesDateTime(order.created_at)}</TableCell>
                      <TableCell className="capitalize">{order.voided ? "voided" : order.status}</TableCell>
                      <TableCell className="text-right">{formatMVR(order.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>

      <Dialog open={settleOpen} onOpenChange={(v) => !settling && setSettleOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
            <DialogDescription>
              {customer?.full_name} owes {formatMVR(balance)}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="settle-amount">Amount received</Label>
              <Input
                id="settle-amount"
                type="number"
                min={0}
                max={balance}
                step="0.01"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Paid via</Label>
              <div className="grid grid-cols-2 gap-2">
                {settleMethods.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSettleMethodId(m.id)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                      settleMethodId === m.id ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"
                    )}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settle-reference">Reference (optional)</Label>
              <Input id="settle-reference" placeholder="Slip / transaction number" value={settleReference} onChange={(e) => setSettleReference(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleOpen(false)} disabled={settling}>
              Cancel
            </Button>
            <Button onClick={handleSettle} disabled={settling || !settleMethodId}>
              {settling && <Loader2 className="h-4 w-4 animate-spin" />}
              Record payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
