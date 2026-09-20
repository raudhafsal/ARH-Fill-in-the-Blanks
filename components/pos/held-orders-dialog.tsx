"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatMVR, formatMaldivesTime } from "@/lib/utils";
import type { HeldOrder } from "@/lib/pos/types";
import { computeCartTotals } from "@/lib/pos/cart-math";
import type { TaxSettings } from "@/types/database";
import { EmptyState } from "@/components/shared/empty-state";
import { Inbox } from "lucide-react";

export function HeldOrdersDialog({
  open,
  onOpenChange,
  heldOrders,
  taxSettings,
  onResume,
  onDiscard,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heldOrders: HeldOrder[];
  taxSettings: Pick<TaxSettings, "enabled" | "percentage" | "price_inclusive"> | null;
  onResume: (order: HeldOrder) => void;
  onDiscard: (order: HeldOrder) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Held orders</DialogTitle>
          <DialogDescription>Draft orders saved on this device, before payment.</DialogDescription>
        </DialogHeader>
        {heldOrders.length === 0 ? (
          <EmptyState icon={Inbox} title="No held orders" description="Use “Hold” on the POS screen to save a cart for later." className="border-none py-8" />
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
            {heldOrders.map((order) => {
              const totals = computeCartTotals(order.cart, order.orderDiscount, taxSettings);
              return (
                <li key={order.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {order.cart.length} item{order.cart.length === 1 ? "" : "s"} · {formatMVR(totals.total)}
                      </p>
                      <p className="text-xs text-muted-foreground">Held at {formatMaldivesTime(order.heldAt)}</p>
                      {order.customerName && <p className="text-xs text-muted-foreground">Customer: {order.customerName}</p>}
                    </div>
                  </div>
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {order.cart.slice(0, 4).map((item) => (
                      <li key={item.lineId}>
                        {item.quantity}× {item.productName}
                      </li>
                    ))}
                    {order.cart.length > 4 && <li>+{order.cart.length - 4} more…</li>}
                  </ul>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => onResume(order)}>
                      Resume
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => onDiscard(order)}>
                      Discard
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
