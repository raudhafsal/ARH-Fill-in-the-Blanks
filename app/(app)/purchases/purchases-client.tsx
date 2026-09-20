"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Purchase, PurchasePaymentStatus } from "@/types/database";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PurchasesNav } from "./purchases-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Truck, Plus, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatMVR, formatMaldivesDate } from "@/lib/utils";

export type PurchaseRow = Purchase & { supplier: { name: string } | null };

const statusVariant: Record<string, "secondary" | "success" | "destructive"> = {
  draft: "secondary",
  received: "success",
  cancelled: "destructive",
};

const PAYMENT_STATUSES: PurchasePaymentStatus[] = ["unpaid", "partial", "paid"];

export function PurchasesClient({ initialPurchases }: { initialPurchases: PurchaseRow[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [purchases, setPurchases] = useState<PurchaseRow[]>(initialPurchases);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PurchaseRow | null>(null);
  const [paymentUpdatingId, setPaymentUpdatingId] = useState<string | null>(null);

  async function refresh() {
    const { data } = await supabase
      .from("purchases")
      .select("*, supplier:suppliers(name)")
      .order("created_at", { ascending: false });
    setPurchases((data ?? []) as PurchaseRow[]);
  }

  async function handleReceive(purchase: PurchaseRow) {
    setReceivingId(purchase.id);
    try {
      const { error } = await supabase.rpc("receive_purchase", { p_purchase_id: purchase.id });
      if (error) throw error;
      toast.success("Purchase received. Stock updated.");
      await refresh();
    } catch {
      toast.error("Unable to receive purchase. Please try again.");
    } finally {
      setReceivingId(null);
    }
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    try {
      const { error } = await supabase.from("purchases").update({ status: "cancelled" }).eq("id", cancelTarget.id);
      if (error) throw error;
      toast.success("Purchase cancelled.");
      await refresh();
    } catch {
      toast.error("Unable to cancel purchase.");
    } finally {
      setCancelTarget(null);
    }
  }

  async function handlePaymentStatus(purchase: PurchaseRow, status: PurchasePaymentStatus) {
    setPaymentUpdatingId(purchase.id);
    try {
      const { error } = await supabase.from("purchases").update({ payment_status: status }).eq("id", purchase.id);
      if (error) throw error;
      await refresh();
    } catch {
      toast.error("Unable to update payment status.");
    } finally {
      setPaymentUpdatingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Purchases"
        description="Record purchase orders from suppliers and receive stock."
        actions={
          <Button asChild>
            <Link href="/purchases/new">
              <Plus className="h-4 w-4" />
              New purchase
            </Link>
          </Button>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <PurchasesNav />

        {purchases.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No purchases yet"
            description="Create a purchase order to start receiving stock from suppliers."
            action={
              <Button asChild>
                <Link href="/purchases/new">
                  <Plus className="h-4 w-4" />
                  New purchase
                </Link>
              </Button>
            }
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap text-sm">{formatMaldivesDate(p.purchase_date)}</TableCell>
                      <TableCell>
                        {p.status === "draft" ? (
                          <Link href={`/purchases/${p.id}`} className="font-medium hover:underline">
                            {p.supplier?.name ?? "—"}
                          </Link>
                        ) : (
                          p.supplier?.name ?? "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.invoice_number ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[p.status]} className="capitalize">
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={p.payment_status}
                          onValueChange={(v) => handlePaymentStatus(p, v as PurchasePaymentStatus)}
                          disabled={paymentUpdatingId === p.id}
                        >
                          <SelectTrigger className="h-8 w-28 capitalize">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_STATUSES.map((s) => (
                              <SelectItem key={s} value={s} className="capitalize">
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatMVR(p.total_cost)}</TableCell>
                      <TableCell className="text-right">
                        {p.status === "draft" && (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={receivingId === p.id}
                              onClick={() => handleReceive(p)}
                            >
                              {receivingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                              Receive
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setCancelTarget(p)}
                            >
                              <X className="h-3.5 w-3.5" />
                              Cancel
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel purchase?"
        description="This purchase will be marked as cancelled and can no longer be edited or received."
        confirmLabel="Cancel purchase"
        onConfirm={handleCancel}
      />
    </div>
  );
}
