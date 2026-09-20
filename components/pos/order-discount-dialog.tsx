"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { OrderDiscount } from "@/lib/pos/types";
import type { DiscountKind } from "@/types/database";
import { toast } from "sonner";

export function OrderDiscountDialog({
  open,
  onOpenChange,
  value,
  maxDiscountPercent,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: OrderDiscount;
  maxDiscountPercent: number;
  onSave: (discount: OrderDiscount) => void;
}) {
  const [type, setType] = useState<"none" | DiscountKind>(value.type ?? "none");
  const [amount, setAmount] = useState(String(value.value || 0));

  useEffect(() => {
    if (open) {
      setType(value.type ?? "none");
      setAmount(String(value.value || 0));
    }
  }, [open, value.type, value.value]);

  function handleSave() {
    const num = Number(amount);
    if (type !== "none") {
      if (!Number.isFinite(num) || num < 0) {
        toast.error("Enter a valid discount amount.");
        return;
      }
      if (type === "percentage" && num > maxDiscountPercent) {
        toast.error(`Your role can discount at most ${maxDiscountPercent}%.`);
        return;
      }
    }
    onSave({ type: type === "none" ? null : type, value: type === "none" ? 0 : num });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Whole-order discount</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as "none" | DiscountKind)}>
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
            <Label htmlFor="order-discount-value">Value</Label>
            <Input
              id="order-discount-value"
              type="number"
              min={0}
              step="0.01"
              disabled={type === "none"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        {type === "percentage" && <p className="text-xs text-muted-foreground">Your role can discount up to {maxDiscountPercent}%.</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
