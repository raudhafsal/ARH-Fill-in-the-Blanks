"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OrderStatus } from "@/types/database";
import type { KitchenOrder } from "./page";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMaldivesTime } from "@/lib/utils";
import { ChefHat, Clock, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const COLUMNS: { status: OrderStatus; label: string }[] = [
  { status: "new", label: "New" },
  { status: "preparing", label: "Preparing" },
  { status: "ready", label: "Ready" },
];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  new: "preparing",
  preparing: "ready",
  ready: "completed",
};

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  new: "Start preparing",
  preparing: "Mark ready",
  ready: "Mark completed",
};

export function KitchenClient({ initialOrders, canUpdate }: { initialOrders: KitchenOrder[]; canUpdate: boolean }) {
  const [orders, setOrders] = useState(initialOrders);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .in("status", ["new", "preparing", "ready"])
        .eq("voided", false)
        .order("created_at", { ascending: true });
      if (data) setOrders(data as KitchenOrder[]);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  async function advance(order: KitchenOrder) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setUpdatingId(order.id);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("orders").update({ status: next }).eq("id", order.id);
      if (error) throw error;
      setOrders((prev) =>
        next === "completed" ? prev.filter((o) => o.id !== order.id) : prev.map((o) => (o.id === order.id ? { ...o, status: next } : o))
      );
      toast.success(`Order ${order.order_number} moved to ${next}.`);
    } catch {
      toast.error("Unable to update order status.");
    } finally {
      setUpdatingId(null);
    }
  }

  const hasAny = orders.length > 0;

  return (
    <div>
      <PageHeader title="Kitchen" description="Live preparation screen — orders refresh automatically." />

      <div className="p-4 sm:p-6">
        {!canUpdate && (
          <p className="mb-4 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            You can view kitchen tickets, but only managers and administrators can advance order status.
          </p>
        )}

        {!hasAny ? (
          <EmptyState icon={ChefHat} title="No active orders" description="New orders will appear here automatically." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {COLUMNS.map((col) => {
              const columnOrders = orders.filter((o) => o.status === col.status);
              return (
                <div key={col.status} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-muted-foreground">{col.label}</h2>
                    <Badge variant="secondary">{columnOrders.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {columnOrders.map((order) => (
                      <Card key={order.id}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{order.order_number}</CardTitle>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatMaldivesTime(order.created_at)}
                            </span>
                          </div>
                          <p className="text-xs capitalize text-muted-foreground">{order.order_type.replace("_", " ")}</p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <ul className="space-y-1 text-sm">
                            {order.order_items.map((item) => (
                              <li key={item.id} className="flex items-start justify-between gap-2">
                                <span>
                                  <span className="font-medium">{item.quantity}×</span> {item.product_name}
                                  {item.notes && <span className="block text-xs text-muted-foreground">{item.notes}</span>}
                                </span>
                              </li>
                            ))}
                          </ul>
                          {order.notes && <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">{order.notes}</p>}
                          {canUpdate && NEXT_STATUS[order.status] && (
                            <Button
                              size="sm"
                              className="w-full"
                              disabled={updatingId === order.id}
                              onClick={() => advance(order)}
                              variant={order.status === "ready" ? "success" : "default"}
                            >
                              {order.status === "ready" ? <CheckCircle2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                              {NEXT_LABEL[order.status]}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
