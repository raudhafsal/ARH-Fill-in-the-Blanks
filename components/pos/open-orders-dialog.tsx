"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatMVR, formatMaldivesTime, cn } from "@/lib/utils";
import type { OrderTab } from "@/lib/pos/types";
import { computeCartTotals } from "@/lib/pos/cart-math";
import type { TaxSettings } from "@/types/database";
import { Plus, X } from "lucide-react";

/** Rough "how long ago" label — good enough for a glance at the orders list, no live ticking needed. */
function elapsedLabel(openedAt: string): string {
  const ms = Date.now() - new Date(openedAt).getTime();
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

export function OpenOrdersDialog({
  open,
  onOpenChange,
  tabs,
  activeTabId,
  taxSettings,
  onSelect,
  onClose,
  onAddNew,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabs: OrderTab[];
  activeTabId: string;
  taxSettings: Pick<TaxSettings, "enabled" | "percentage" | "price_inclusive"> | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onAddNew: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-6">
            <span>Open orders</span>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                onAddNew();
                onOpenChange(false);
              }}
            >
              <Plus className="h-3.5 w-3.5" /> New order
            </Button>
          </DialogTitle>
          <DialogDescription>Orders still being taken at this register — tap one to view and continue it.</DialogDescription>
        </DialogHeader>

        <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto">
          {tabs.map((tab) => {
            const totals = computeCartTotals(tab.cart, tab.orderDiscount, taxSettings);
            const itemCount = tab.cart.reduce((s, i) => s + i.quantity, 0);
            const isActive = tab.id === activeTabId;
            return (
              <li key={tab.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(tab.id);
                    onOpenChange(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors",
                    isActive ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {tab.label}
                      {isActive && <span className="ml-1.5 text-xs font-normal text-primary">(viewing)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {itemCount === 0 ? "Empty bill" : `${itemCount} item${itemCount === 1 ? "" : "s"}`}
                      {" · opened "}
                      {formatMaldivesTime(tab.openedAt)}
                      {" · "}
                      {elapsedLabel(tab.openedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <p className="text-sm font-semibold">{formatMVR(totals.total)}</p>
                    <span
                      role="button"
                      aria-label={`Close ${tab.label}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose(tab.id);
                      }}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
