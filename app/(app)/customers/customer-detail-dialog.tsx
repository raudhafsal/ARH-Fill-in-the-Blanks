"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Customer, Order } from "@/types/database";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMVR, formatMaldivesDateTime } from "@/lib/utils";
import { Receipt, Loader2 } from "lucide-react";

export function CustomerDetailDialog({
  customer,
  onOpenChange,
}: {
  customer: Customer | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customer) return;
    let cancelled = false;
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("orders")
      .select("*")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) {
          setOrders((data ?? []) as Order[]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [customer]);

  const validOrders = orders.filter((o) => !o.voided);
  const totalSpent = validOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const lastOrder = orders[0];

  return (
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
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Total orders" value={String(validOrders.length)} />
              <StatCard label="Total spent" value={formatMVR(totalSpent)} />
              <StatCard label="Last order" value={lastOrder ? formatMaldivesDateTime(lastOrder.created_at) : "—"} />
            </div>

            {customer?.notes && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">{customer.notes}</div>
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
  );
}
