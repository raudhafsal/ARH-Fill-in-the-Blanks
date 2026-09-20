"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { CartItem } from "@/lib/pos/types";
import type { DiscountKind } from "@/types/database";
import { toast } from "sonner";

export function CartItemEditDialog({
  item,
  open,
  onOpenChange,
  maxDiscountPercent,
  onSave,
}: {
  item: CartItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maxDiscountPercent: number;
  onSave: (lineId: string, notes: string, discountType: DiscountKind | null, discountValue: number) => void;
}) {
  const [notes, setNotes] = useState("");
  const [discountType, setDiscountType] = useState<"none" | DiscountKind>("none");
  const [discountValue, setDiscountValue] = useState("0");

  function handleOpenChange(next: boolean) {
    if (next && item) {
      setNotes(item.notes);
      setDiscountType(item.discountType ?? "none");
      setDiscountValue(String(item.discountValue || 0));
    }
    onOpenChange(next);
  }

  function handleSave() {
    if (!item) return;
    const value = Number(discountValue);
    if (discountType !== "none") {
      if (!Number.isFinite(value) || value < 0) {
        toast.error("Enter a valid discount amount.");
        return;
      }
      if (discountType === "percentage" && value > maxDiscountPercent) {
        toast.error(`Your role can discount at most ${maxDiscountPercent}%.`);
        return;
      }
    }
    onSave(item.lineId, notes.trim(), discountType === "none" ? null : discountType, discountType === "none" ? 0 : value);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item?.productName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="item-note">Note</Label>
            <textarea
              id="item-note"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. No onions"
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Discount</Label>
              <Select value={discountType} onValueChange={(v) => setDiscountType(v as "none" | DiscountKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="percentage">Percent (%)</SelectItem>
                  <SelectItem value="fixed">Amount (MVR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-discount-value">Value</Label>
              <Input
                id="item-discount-value"
                type="number"
                min={0}
                step="0.01"
                disabled={discountType === "none"}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
              />
            </div>
          </div>
          {discountType === "percentage" && (
            <p className="text-xs text-muted-foreground">Your role can discount up to {maxDiscountPercent}%.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
