"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { Supplier, Purchase } from "@/types/database";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PurchasesNav } from "@/app/(app)/purchases/purchases-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Truck, Loader2, History } from "lucide-react";
import { toast } from "sonner";
import { formatMVR, formatMaldivesDate } from "@/lib/utils";

const supplierSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  contact_person: z.string().trim().max(150).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().max(150).optional(),
  address: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(500).optional(),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

const emptyForm: SupplierFormValues = { name: "", contact_person: "", phone: "", email: "", address: "", notes: "" };

const statusVariant: Record<string, "secondary" | "success" | "destructive"> = {
  draft: "secondary",
  received: "success",
  cancelled: "destructive",
};

export function SuppliersClient({ initialSuppliers }: { initialSuppliers: Supplier[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierFormValues>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const [historyTarget, setHistoryTarget] = useState<Supplier | null>(null);
  const [historyPurchases, setHistoryPurchases] = useState<Purchase[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function refresh() {
    const { data } = await supabase.from("suppliers").select("*").order("name", { ascending: true });
    setSuppliers((data ?? []) as Supplier[]);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setDialogOpen(true);
  }

  function openEdit(supplier: Supplier) {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      contact_person: supplier.contact_person ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
      notes: supplier.notes ?? "",
    });
    setErrors({});
    setDialogOpen(true);
  }

  async function handleSubmit() {
    const result = supplierSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const payload = {
        name: result.data.name,
        contact_person: result.data.contact_person || null,
        phone: result.data.phone || null,
        email: result.data.email || null,
        address: result.data.address || null,
        notes: result.data.notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("suppliers").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Supplier updated.");
      } else {
        const { error } = await supabase.from("suppliers").insert(payload);
        if (error) throw error;
        toast.success("Supplier created.");
      }
      setDialogOpen(false);
      await refresh();
    } catch {
      toast.error("Unable to save supplier. Please check the details and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from("suppliers").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success("Supplier deleted.");
      await refresh();
    } catch {
      toast.error("Unable to delete supplier. It may have existing purchases linked to it.");
    } finally {
      setDeleteTarget(null);
    }
  }

  async function openHistory(supplier: Supplier) {
    setHistoryTarget(supplier);
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("purchases")
        .select("*")
        .eq("supplier_id", supplier.id)
        .order("purchase_date", { ascending: false });
      if (error) throw error;
      setHistoryPurchases((data ?? []) as Purchase[]);
    } catch {
      toast.error("Unable to load purchase history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  const historyTotal = historyPurchases.reduce((s, p) => s + Number(p.total_cost), 0);

  return (
    <div>
      <PageHeader
        title="Suppliers"
        description="Manage suppliers and view their purchase history."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New supplier
          </Button>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <PurchasesNav />

        {suppliers.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No suppliers yet"
            description="Add a supplier to start recording purchases."
            action={
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                New supplier
              </Button>
            }
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.contact_person ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.phone ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.email ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openHistory(s)} aria-label="Purchase history">
                            <History className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)} aria-label="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(s)}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit supplier" : "New supplier"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="s-name">Name</Label>
              <Input id="s-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-contact">Contact person</Label>
              <Input id="s-contact" value={form.contact_person} onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="s-phone">Phone</Label>
                <Input id="s-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-email">Email</Label>
                <Input id="s-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-address">Address</Label>
              <Textarea id="s-address" rows={2} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-notes">Notes</Label>
              <Textarea id="s-notes" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create supplier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyTarget} onOpenChange={(open) => !open && setHistoryTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Purchase history — {historyTarget?.name}</DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : historyPurchases.length === 0 ? (
            <EmptyState icon={Truck} title="No purchases from this supplier yet" />
          ) : (
            <div className="space-y-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyPurchases.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">{formatMaldivesDate(p.purchase_date)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.invoice_number ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[p.status]} className="capitalize">
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatMVR(p.total_cost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end border-t pt-3 text-sm font-medium">Total: {formatMVR(historyTotal)}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete supplier?"
        description={`This will permanently delete "${deleteTarget?.name}".`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}
