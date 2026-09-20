"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn, formatMVR, round2 } from "@/lib/utils";
import type { PaymentMethod } from "@/types/database";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function PaymentDialog({
  open,
  onOpenChange,
  total,
  paymentMethods,
  processing,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  paymentMethods: PaymentMethod[];
  processing: boolean;
  onConfirm: (payment: { paymentMethodId: string; amountReceived: number | null; changeAmount: number; reference: string | null }) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amountReceived, setAmountReceived] = useState("");
  const [reference, setReference] = useState("");

  useEffect(() => {
    if (open) {
      setSelectedId(paymentMethods[0]?.id ?? null);
      setAmountReceived(total.toFixed(2));
      setReference("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selected = paymentMethods.find((m) => m.id === selectedId) ?? null;
  const isCash = selected?.code === "cash";
  const receivedNum = Number(amountReceived) || 0;
  const change = isCash ? round2(Math.max(receivedNum - total, 0)) : 0;
  const insufficientCash = isCash && receivedNum < total;

  function handleConfirm() {
    if (!selected) {
      toast.error("Choose a payment method.");
      return;
    }
    if (isCash && insufficientCash) {
      toast.error("Amount received is less than the total due.");
      return;
    }
    onConfirm({
      paymentMethodId: selected.id,
      amountReceived: isCash ? receivedNum : null,
      changeAmount: change,
      reference: reference.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !processing && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Payment</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg bg-muted p-4 text-center">
          <p className="text-sm text-muted-foreground">Total due</p>
          <p className="text-3xl font-bold">{formatMVR(total)}</p>
        </div>

        <div className="space-y-1.5">
          <Label>Payment method</Label>
          <div className="grid grid-cols-2 gap-2">
            {paymentMethods.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedId(m.id)}
                className={cn(
                  "pos-tap rounded-md border px-3 py-3 text-sm font-medium transition-colors",
                  selectedId === m.id ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"
                )}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        {isCash ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount-received">Amount received</Label>
              <Input
                id="amount-received"
                type="number"
                min={0}
                step="0.01"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Change</Label>
              <div className={cn("flex h-10 items-center rounded-md border px-3 text-sm font-semibold", insufficientCash ? "border-destructive text-destructive" : "bg-muted")}>
                {formatMVR(change)}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="payment-reference">Reference (optional)</Label>
            <Input id="payment-reference" placeholder="Transaction / slip number" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={processing || !selected || (isCash && insufficientCash)} size="lg">
            {processing && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
