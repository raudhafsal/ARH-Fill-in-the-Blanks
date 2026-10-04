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
import { formatMVR, formatMaldivesDateTime } from "@/lib/utils";
import { DenominationCounter } from "@/components/register/denomination-counter";
import { ReconciliationTable } from "@/components/register/reconciliation-table";
import { CloseRegisterDialog } from "@/components/register/close-register-dialog";
import { cleanDenominations, type Denominations } from "@/lib/register";
import type { CashRegister, Profile, RegisterSummaryRow, RegisterTxnType } from "@/types/database";
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
  summary,
}: {
  profile: Profile;
  openRegister: CashRegister | null;
  transactions: RegisterTxn[];
  summary: RegisterSummaryRow[];
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

  const [openingDenoms, setOpeningDenoms] = useState<Denominations>({});
  const [closeOpen, setCloseOpen] = useState(false);

  const expectedCash = useMemo(() => summary.find((r) => r.is_cash)?.expected ?? Number(openRegister?.opening_cash ?? 0), [summary, openRegister]);
  const reconRows = useMemo(
    () =>
      summary.map((r) => ({
        id: r.payment_method_id,
        name: r.method_name,
        isCash: r.is_cash,
        isCredit: r.is_credit,
        opening: r.opening,
        received: r.received,
        expected: r.expected,
      })),
    [summary]
  );

  async function handleOpenRegister() {
    const amount = Number(openingCash);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a valid opening cash amount.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("open_register_session", {
      p_opening_cash: amount,
      p_notes: openingNotes.trim() || null,
      p_denominations: cleanDenominations(openingDenoms),
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message?.includes("already have an open") ? "You already have an open register." : "Unable to open the register. Please try again.");
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
            <DenominationCounter
              value={openingDenoms}
              onChange={(next, total) => {
                setOpeningDenoms(next);
                if (total > 0) setOpeningCash(String(total));
              }}
            />
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
        description={`Session #${openRegister.session_no} · open since ${formatMaldivesDateTime(openRegister.opened_at)}`}
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
            <CardTitle className="text-base">Payments this session</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            <ReconciliationTable rows={reconRows} showClosing={false} />
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

      <CloseRegisterDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        registerId={openRegister.id}
        summary={summary}
        onClosed={() => {
          router.push("/dashboard");
          router.refresh();
        }}
      />
    </div>
  );
}
