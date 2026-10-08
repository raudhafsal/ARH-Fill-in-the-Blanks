"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn, formatMVR, round2 } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Customer, PaymentMethod } from "@/types/database";
import { Loader2, Search, UserCircle2, Plus, X } from "lucide-react";
import { toast } from "sonner";

/** A payment method is treated as "credit" (owed by a customer) by its code, since the method
 * itself is admin-configurable — the seeded "Credit" method's code is a slugified "credit_<id>". */
function isCreditMethod(method: PaymentMethod | null): boolean {
  return !!method && method.code.startsWith("credit");
}

export function PaymentDialog({
  open,
  onOpenChange,
  total,
  paymentMethods,
  customers,
  onCustomerCreated,
  processing,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  paymentMethods: PaymentMethod[];
  customers: Customer[];
  onCustomerCreated: (customer: Customer) => void;
  processing: boolean;
  onConfirm: (payment: {
    paymentMethodId: string;
    amountReceived: number | null;
    changeAmount: number;
    reference: string | null;
    customerId: string | null;
  }) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amountReceived, setAmountReceived] = useState("");
  const [reference, setReference] = useState("");

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedId(paymentMethods[0]?.id ?? null);
      setAmountReceived(total.toFixed(2));
      setReference("");
      setCustomerId(null);
      setCustomerSearch("");
      setAddingCustomer(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selected = paymentMethods.find((m) => m.id === selectedId) ?? null;
  const isCash = selected?.code === "cash";
  const isCredit = isCreditMethod(selected);
  const receivedNum = Number(amountReceived) || 0;
  const change = isCash ? round2(Math.max(receivedNum - total, 0)) : 0;
  const insufficientCash = isCash && receivedNum < total;

  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null;
  const [owed, setOwed] = useState<number | null>(null);
  useEffect(() => {
    setOwed(null);
    if (!open || !isCredit || !customerId) return;
    let cancelled = false;
    createClient()
      .from("customer_credit_balances")
      .select("balance")
      .eq("customer_id", customerId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setOwed(Number((data as { balance: number } | null)?.balance ?? 0));
      });
    return () => {
      cancelled = true;
    };
  }, [open, isCredit, customerId]);
  const creditLimit = selectedCustomer?.credit_limit ?? null;
  const afterSale = owed != null ? round2(owed + total) : null;
  const overLimit = isCredit && creditLimit != null && afterSale != null && afterSale > creditLimit;
  const available = creditLimit != null && owed != null ? Math.max(round2(creditLimit - owed), 0) : null;
  const matchingCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers.filter((c) => c.full_name.toLowerCase().includes(q) || (c.phone ?? "").toLowerCase().includes(q)).slice(0, 8);
  }, [customers, customerSearch]);

  async function saveNewCustomer() {
    if (!newCustomerName.trim()) return;
    setSavingCustomer(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("customers")
        .insert({ full_name: newCustomerName.trim(), phone: newCustomerPhone.trim() || null })
        .select()
        .single();
      if (error) throw error;
      const customer = data as Customer;
      onCustomerCreated(customer);
      setCustomerId(customer.id);
      setAddingCustomer(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      toast.success("Customer added.");
    } catch {
      toast.error("Unable to add customer.");
    } finally {
      setSavingCustomer(false);
    }
  }

  function handleConfirm() {
    if (!selected) {
      toast.error("Choose a payment method.");
      return;
    }
    if (isCash && insufficientCash) {
      toast.error("Amount received is less than the total due.");
      return;
    }
    if (isCredit && !customerId) {
      toast.error("Select a customer for this credit sale.");
      return;
    }
    if (overLimit) {
      toast.error("This sale exceeds the customer's credit limit.");
      return;
    }
    onConfirm({
      paymentMethodId: selected.id,
      amountReceived: isCash ? receivedNum : null,
      changeAmount: change,
      reference: reference.trim() || null,
      customerId: isCredit ? customerId : null,
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

        {isCredit ? (
          <div className="space-y-2">
            <Label>Customer</Label>
            {selectedCustomer ? (
              <>
              <div className="flex items-center justify-between gap-2 rounded-md border bg-primary/5 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <UserCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{selectedCustomer.full_name}</p>
                    {selectedCustomer.phone && <p className="text-xs text-muted-foreground">{selectedCustomer.phone}</p>}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setCustomerId(null)}>
                  Change
                </Button>
              </div>
            {owed != null && (
              <div className={cn("rounded-md border px-3 py-2 text-xs", overLimit ? "border-destructive bg-destructive/10 text-destructive" : "bg-muted")}>
                <p>Currently owes {formatMVR(owed)}{creditLimit != null ? ` · Limit ${formatMVR(creditLimit)} · Available ${formatMVR(available ?? 0)}` : " · No credit limit"}</p>
                {overLimit && <p className="mt-1 font-medium">This sale would bring the balance to {formatMVR(afterSale ?? 0)}, over the limit. Choose another payment method or reduce the order.</p>}
              </div>
            )}
              </>
            ) : addingCustomer ? (
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">New customer</p>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAddingCustomer(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input placeholder="Name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} autoFocus />
                <Input placeholder="Phone (optional)" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} />
                <Button size="sm" className="w-full" onClick={saveNewCustomer} disabled={savingCustomer || !newCustomerName.trim()}>
                  {savingCustomer && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save customer
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search customer by name or phone…"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="pl-8"
                    autoFocus
                  />
                </div>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {matchingCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCustomerId(c.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span className="truncate">{c.full_name}</span>
                      {c.phone && <span className="shrink-0 text-xs text-muted-foreground">{c.phone}</span>}
                    </button>
                  ))}
                  {matchingCustomers.length === 0 && (
                    <p className="py-2 text-center text-xs text-muted-foreground">No matching customers.</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => {
                    setNewCustomerName(customerSearch.trim());
                    setAddingCustomer(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> Add new customer
                </Button>
              </div>
            )}
          </div>
        ) : isCash ? (
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
          <Button onClick={handleConfirm} disabled={processing || !selected || (isCash && insufficientCash) || (isCredit && !customerId) || overLimit} size="lg">
            {processing && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
