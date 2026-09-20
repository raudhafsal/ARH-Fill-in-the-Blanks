"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { formatMVR, cn } from "@/lib/utils";
import type { CartItem, CartTotals } from "@/lib/pos/types";
import type { OrderType } from "@/types/database";
import { Minus, Plus, Trash2, Pencil, Percent, PauseCircle, RotateCcw } from "lucide-react";

export function CartPanel({
  cart,
  totals,
  orderType,
  dineInEnabled,
  orderNotes,
  onOrderNotesChange,
  onOrderTypeChange,
  onQtyChange,
  onRemove,
  onEditItem,
  onOpenDiscount,
  onHold,
  onNewOrder,
  onPay,
  className,
}: {
  cart: CartItem[];
  totals: CartTotals;
  orderType: OrderType;
  dineInEnabled: boolean;
  orderNotes: string;
  onOrderNotesChange: (v: string) => void;
  onOrderTypeChange: (v: OrderType) => void;
  onQtyChange: (lineId: string, qty: number) => void;
  onRemove: (lineId: string) => void;
  onEditItem: (lineId: string) => void;
  onOpenDiscount: () => void;
  onHold: () => void;
  onNewOrder: () => void;
  onPay: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <Select value={orderType} onValueChange={(v) => onOrderTypeChange(v as OrderType)}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="takeaway">Takeaway</SelectItem>
            <SelectItem value="pickup">Pickup</SelectItem>
            {dineInEnabled && <SelectItem value="dine_in">Dine-in</SelectItem>}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={onNewOrder} className="gap-1 text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" /> New order
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {cart.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Cart is empty. Tap a product to add it.</p>
        ) : (
          <ul className="space-y-3">
            {cart.map((item) => (
              <li key={item.lineId} className="rounded-lg border p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">{formatMVR(item.unitPrice)} each</p>
                    {item.notes && <p className="mt-0.5 truncate text-xs italic text-muted-foreground">“{item.notes}”</p>}
                    {item.discountType && item.discountValue > 0 && (
                      <Badge variant="secondary" className="mt-1 gap-1">
                        <Percent className="h-3 w-3" />
                        {item.discountType === "percentage" ? `${item.discountValue}% off` : `${formatMVR(item.discountValue)} off`}
                      </Badge>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditItem(item.lineId)} aria-label="Edit note / discount">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onRemove(item.lineId)} aria-label="Remove">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onQtyChange(item.lineId, item.quantity - 1)}>
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onQtyChange(item.lineId, item.quantity + 1)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-sm font-semibold">{formatMVR(item.unitPrice * item.quantity)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t p-3">
        <div className="space-y-1.5">
          <textarea
            value={orderNotes}
            onChange={(e) => onOrderNotesChange(e.target.value)}
            placeholder="Order notes, e.g. Customer will collect at 7:30 PM"
            rows={2}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <button
          type="button"
          onClick={onOpenDiscount}
          className="flex w-full items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"
        >
          <span className="flex items-center gap-1.5">
            <Percent className="h-3.5 w-3.5" /> Whole-order discount (F8)
          </span>
          {totals.orderDiscountAmount > 0 && <span className="font-medium text-foreground">-{formatMVR(totals.orderDiscountAmount)}</span>}
        </button>

        <Separator />

        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatMVR(totals.subtotal)}</span>
          </div>
          {totals.discountAmount > 0 && (
            <div className="flex justify-between text-destructive">
              <span>Discount</span>
              <span>-{formatMVR(totals.discountAmount)}</span>
            </div>
          )}
          {totals.taxAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatMVR(totals.taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between pt-1 text-base font-semibold">
            <span>Total</span>
            <span>{formatMVR(totals.total)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" className="gap-1.5" onClick={onHold} disabled={cart.length === 0}>
            <PauseCircle className="h-4 w-4" /> Hold (F6)
          </Button>
          <Button size="lg" onClick={onPay} disabled={cart.length === 0}>
            Pay (F4)
          </Button>
        </div>
      </div>
    </div>
  );
}
