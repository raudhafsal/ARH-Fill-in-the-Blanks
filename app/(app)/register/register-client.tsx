"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { formatMVR, formatMaldivesDateTime, round2 } from "@/lib/utils";
import type { CashRegister, Profile, RegisterTxnType } from "@/types/database";
import { Loader2, PlusCircle, MinusCircle, Lock } from "lucide-react";

interface RegisterTxn {
  id: string;
  type: string;
  amount: number;
  reason: string | null;
  notes: string | null;
  created_at: string;
}

export function RegisterClient({
  profile,
  openRegister,
  transactions,
}: {
  profile: Profile;
  openRegister: CashRegister | null;
  transactions: RegisterTxn[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [openingCash, setOpeningCash] = useState("0");
  const [openingNotes, setOpeningNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [movementOpen, setMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<Extract<RegisterTxnType, "cash_in" | "cash_out">>("cash_in");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [movementNotes, setMovementNotes] = useState("");

  const [closeOpen, setCloseOpen] = useState(false);
  const [closeStep, setCloseStep] = useState<"count" | "confirm">("count");
  const [actualCash, setActualCash] = useState("");
  const [closingNotes, setClosingNotes] = useState("");

  const expectedCash = useMemo(() => {
    if (!openRegister) return 0;
    const delta = transactions.reduce((sum, t) => {
      if (t.type === "cash_sale" || t.type === "cash_in" || t.type === "opening_float") return sum + Number(t.amount);
      if (t.type === "cash_refund" || t.type === "cash_out") return sum - Number(t.amount);
      return sum;
    }, 0);
    return round2(Number(openRegister.opening_cash) + delta);
  }, [openRegister, transactions]);

  async function handleOpenRegister() {
    const amount = Number(openingCash);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a valid opening cash amount.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("cash_registers").insert({
      cashier_id: profile.id,
      opening_cash: amount,
      opening_notes: openingNotes.trim() || null,
      status: "open",
    });
    setSubmitting(false);
    if (error) {
      toast.error("Unable to open the register. Please try again.");
      return;
    }
    toast.success("Register opened.");
    router.refresh();
  }

  async function handleMovement() {
    if (!openRegister) return;
    const amount = Number(movementAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    if (!movementReason.trim()) {
      toast.error("A reason is required.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("cash_register_movement", {
      p_register_id: openRegister.id,
      p_type: movementType,
      p_amount: amount,
      p_reason: movementReason.trim(),
      p_notes: movementNotes.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Unable to record that cash movement. Please try again.");
      return;
    }
    toast.success(movementType === "cash_in" ? "Cash in recorded." : "Cash out recorded.");
    setMovementOpen(false);
    setMovementAmount("");
    setMovementReason("");
    setMovementNotes("");
    router.refresh();
  }

  async function handleCloseRegister() {
    if (!openRegister) return;
    const amount = Number(actualCash);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Enter the actual cash counted.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("close_register", {
      p_register_id: openRegister.id,
      p_actual_cash: amount,
      p_notes: closingNotes.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Unable to close the register. Please try again.");
      return;
    }
    toast.success("Register closed.");
    setCloseOpen(false);
    setCloseStep("count");
    router.push("/dashboard");
    router.refresh();
  }

  if (!openRegister) {
    return (
      <div className="mx-auto max-w-md space-y-6 p-4 sm:p-6">
        <PageHeader title="Open register" description="Count your starting cash float before making sales." />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Opening float</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="opening-cash">Opening cash (MVR)</Label>
              <Input id="opening-cash" type="number" min={0} step="0.01" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opening-notes">Notes (optional)</Label>
              <Input id="opening-notes" value={openingNotes} onChange={(e) => setOpeningNotes(e.target.value)} placeholder="e.g. Counted with manager" />
            </div>
            <Button className="w-full" size="lg" onClick={handleOpenRegister} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Open register &amp; start selling
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Cash register"
        description={`Open since ${formatMaldivesDateTime(openRegister.opened_at)}`}
        actions={
          <>
            <Button variant="outline" className="gap-1.5" onClick={() => { setMovementType("cash_in"); setMovementOpen(true); }}>
              <PlusCircle className="h-4 w-4" /> Cash in
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={() => { setMovementType("cash_out"); setMovementOpen(true); }}>
              <MinusCircle className="h-4 w-4" /> Cash out
            </Button>
            <Button variant="destructive" className="gap-1.5" onClick={() => setCloseOpen(true)}>
              <Lock className="h-4 w-4" /> Close register
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-3 sm:px-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Opening cash</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatMVR(openRegister.opening_cash)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Expected cash now</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatMVR(expectedCash)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="success">Open</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="px-4 sm:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cash movements this session</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            {transactions.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No cash movements yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{formatMaldivesDateTime(t.created_at)}</TableCell>
                      <TableCell className="capitalize">{t.type.replace("_", " ")}</TableCell>
                      <TableCell>{t.reason ?? "—"}</TableCell>
                      <TableCell className="text-right">{formatMVR(t.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cash in / out */}
      <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{movementType === "cash_in" ? "Cash in" : "Cash out"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={movementType} onValueChange={(v) => setMovementType(v as "cash_in" | "cash_out")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash_in">Cash in</SelectItem>
                  <SelectItem value="cash_out">Cash out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="movement-amount">Amount (MVR)</Label>
              <Input id="movement-amount" type="number" min={0} step="0.01" value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="movement-reason">Reason</Label>
              <Input id="movement-reason" value={movementReason} onChange={(e) => setMovementReason(e.target.value)} placeholder="e.g. Change float top-up" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="movement-notes">Notes (optional)</Label>
              <Input id="movement-notes" value={movementNotes} onChange={(e) => setMovementNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovementOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleMovement} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close register */}
      <Dialog open={closeOpen} onOpenChange={(v) => { setCloseOpen(v); if (!v) setCloseStep("count"); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close register</DialogTitle>
          </DialogHeader>
          {closeStep === "count" ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span>Expected cash</span>
                  <span className="font-semibold">{formatMVR(expectedCash)}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="actual-cash">Actual cash counted (MVR)</Label>
                <Input id="actual-cash" type="number" min={0} step="0.01" value={actualCash} onChange={(e) => setActualCash(e.target.value)} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="closing-notes">Notes (optional)</Label>
                <Input id="closing-notes" value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected</span>
                <span>{formatMVR(expectedCash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Actual counted</span>
                <span>{formatMVR(Number(actualCash) || 0)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Difference</span>
                <span className={round2((Number(actualCash) || 0) - expectedCash) < 0 ? "text-destructive" : "text-success"}>
                  {formatMVR(round2((Number(actualCash) || 0) - expectedCash))}
                </span>
              </div>
              <p className="pt-2 text-xs text-muted-foreground">This closes the register for good — you'll need to open a new one to sell again.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            {closeStep === "count" ? (
              <Button
                onClick={() => {
                  if (!actualCash.trim() || Number(actualCash) < 0) {
                    toast.error("Enter the actual cash counted.");
                    return;
                  }
                  setCloseStep("confirm");
                }}
              >
                Review &amp; close
              </Button>
            ) : (
              <Button variant="destructive" onClick={handleCloseRegister} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
