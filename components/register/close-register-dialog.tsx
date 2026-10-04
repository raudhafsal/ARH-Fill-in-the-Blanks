"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DenominationCounter } from "@/components/register/denomination-counter";
import { formatMVR, round2, cn } from "@/lib/utils";
import { cleanDenominations, type Denominations } from "@/lib/register";
import type { RegisterSummaryRow } from "@/types/database";
import { Loader2 } from "lucide-react";

/**
 * Close-register flow shared by the cashier's own register page and the manager's session details
 * page. Step 1: count each payment type (cash by hand or by notes & coins, the rest default to what
 * the system expects). Step 2: review expected vs counted vs difference, then confirm.
 * The server recomputes "expected" itself — nothing here is trusted for that.
 */
export function CloseRegisterDialog({
  open,
  onOpenChange,
  registerId,
  summary,
  /** Shown in the dialog when a manager is closing somebody else's session. */
  closingForName,
  onClosed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registerId: string;
  summary: RegisterSummaryRow[];
  closingForName?: string | null;
  onClosed: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const rows = useMemo(() => summary.filter((r) => !r.is_credit), [summary]);
  const creditRows = useMemo(() => summary.filter((r) => r.is_credit && r.received > 0), [summary]);

  const [step, setStep] = useState<"count" | "confirm">("count");
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [denoms, setDenoms] = useState<Denominations>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fresh form every time it opens: cash left blank (must be counted), everything else prefilled with expected.
  useEffect(() => {
    if (!open) return;
    const init: Record<string, string> = {};
    for (const r of rows) init[r.payment_method_id] = r.is_cash ? "" : String(round2(r.expected));
    setCounted(init);
    setDenoms({});
    setNotes("");
    setStep("count");
  }, [open, rows]);

  const cashRow = rows.find((r) => r.is_cash);
  const cashMissing = !!cashRow && (counted[cashRow.payment_method_id] ?? "").trim() === "";

  function countedNum(r: RegisterSummaryRow): number {
    const n = Number(counted[r.payment_method_id]);
    return Number.isFinite(n) ? n : 0;
  }

  const totalDifference = round2(rows.reduce((s, r) => s + (countedNum(r) - r.expected), 0));

  function goToConfirm() {
    if (cashMissing) {
      toast.error("Enter the cash counted.");
      return;
    }
    for (const r of rows) {
      const n = Number(counted[r.payment_method_id]);
      if (!Number.isFinite(n) || n < 0) {
        toast.error(`Enter a valid amount for ${r.method_name}.`);
        return;
      }
    }
    setStep("confirm");
  }

  async function handleClose() {
    setSubmitting(true);
    const { error } = await supabase.rpc("close_register_session", {
      p_register_id: registerId,
      p_counts: rows.map((r) => ({ payment_method_id: r.payment_method_id, counted: countedNum(r) })),
      p_denominations: cleanDenominations(denoms),
      p_notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message?.includes("already closed") ? "This register was already closed." : "Unable to close the register. Please try again.");
      return;
    }
    toast.success("Register closed.");
    onOpenChange(false);
    onClosed();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close register</DialogTitle>
        </DialogHeader>

        {closingForName && (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            You&apos;re closing {closingForName}&apos;s register as a manager.
          </p>
        )}

        {step === "count" ? (
          <div className="space-y-4">
            {rows.map((r) => (
              <div key={r.payment_method_id} className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor={`count-${r.payment_method_id}`}>
                    {r.method_name} {r.is_cash ? "counted" : "received"} (MVR)
                  </Label>
                  <span className="text-xs text-muted-foreground">Expected {formatMVR(r.expected)}</span>
                </div>
                <Input
                  id={`count-${r.payment_method_id}`}
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={counted[r.payment_method_id] ?? ""}
                  onChange={(e) => setCounted((c) => ({ ...c, [r.payment_method_id]: e.target.value }))}
                  autoFocus={r.is_cash}
                />
                {r.is_cash && (
                  <DenominationCounter
                    value={denoms}
                    onChange={(next, total) => {
                      setDenoms(next);
                      if (total > 0) setCounted((c) => ({ ...c, [r.payment_method_id]: String(total) }));
                    }}
                  />
                )}
              </div>
            ))}
            {creditRows.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Sold on credit this session (no money to count): {creditRows.map((r) => `${r.method_name} ${formatMVR(r.received)}`).join(", ")}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="closing-notes">Notes (optional)</Label>
              <Input id="closing-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="overflow-hidden rounded-lg border">
              <div className="grid grid-cols-4 gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                <span>Type</span>
                <span className="text-right">Expected</span>
                <span className="text-right">Counted</span>
                <span className="text-right">Difference</span>
              </div>
              {rows.map((r) => {
                const diff = round2(countedNum(r) - r.expected);
                return (
                  <div key={r.payment_method_id} className="grid grid-cols-4 gap-2 px-3 py-2">
                    <span className="font-medium">{r.method_name}</span>
                    <span className="text-right tabular-nums">{r.expected.toFixed(2)}</span>
                    <span className="text-right tabular-nums">{countedNum(r).toFixed(2)}</span>
                    <span
                      className={cn(
                        "text-right tabular-nums",
                        Math.abs(diff) < 0.005 ? "text-muted-foreground" : diff < 0 ? "font-semibold text-destructive" : "font-semibold text-success"
                      )}
                    >
                      {diff.toFixed(2)}
                    </span>
                  </div>
                );
              })}
              <div className="flex justify-between border-t bg-muted/30 px-3 py-2 font-semibold">
                <span>Total difference</span>
                <span className={cn("tabular-nums", totalDifference < 0 ? "text-destructive" : totalDifference > 0 ? "text-success" : "")}>
                  {formatMVR(totalDifference)}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              This closes the register for good — a new one has to be opened to sell again.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === "confirm" ? (
            <Button variant="outline" onClick={() => setStep("count")} disabled={submitting}>
              Back
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
          )}
          {step === "count" ? (
            <Button onClick={goToConfirm}>Review &amp; close</Button>
          ) : (
            <Button variant="destructive" onClick={handleClose} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
