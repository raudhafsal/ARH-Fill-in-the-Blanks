"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { Customer } from "@/types/database";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CustomerDetailDialog } from "./customer-detail-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Users, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

const customerSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type CustomerForm = z.infer<typeof customerSchema>;

const emptyForm: CustomerForm = { full_name: "", phone: "", address: "", notes: "" };

export function CustomersClient({
  initialCustomers,
  canManage,
}: {
  initialCustomers: Customer[];
  canManage: boolean;
}) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerForm, string>>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return customers;
    return customers.filter(
      (c) =>
        c.full_name.toLowerCase().includes(debouncedSearch) ||
        (c.phone ?? "").toLowerCase().includes(debouncedSearch)
    );
  }, [customers, debouncedSearch]);

  async function refetch() {
    const supabase = createClient();
    const { data } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
    setCustomers((data ?? []) as Customer[]);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setDialogOpen(true);
  }

  function openEdit(customer: Customer) {
    setEditing(customer);
    setForm({
      full_name: customer.full_name,
      phone: customer.phone ?? "",
      address: customer.address ?? "",
      notes: customer.notes ?? "",
    });
    setErrors({});
    setDialogOpen(true);
  }

  async function handleSubmit() {
    const parsed = customerSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof CustomerForm, string>> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path[0] as keyof CustomerForm] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        full_name: parsed.data.full_name,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null,
        notes: parsed.data.notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("customers").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Customer updated.");
      } else {
        const { error } = await supabase.from("customers").insert(payload);
        if (error) throw error;
        toast.success("Customer added.");
      }
      setDialogOpen(false);
      await refetch();
    } catch {
      toast.error("Unable to save customer. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(customer: Customer) {
    const supabase = createClient();
    const { error } = await supabase.from("customers").delete().eq("id", customer.id);
    if (error) {
      toast.error("Unable to delete customer.");
      return;
    }
    toast.success("Customer deleted.");
    setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Manage customer records and view order history."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add customer
          </Button>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Users} title="No customers found" description="Try a different search or add a new customer." />
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((customer) => (
                  <TableRow key={customer.id} className="cursor-pointer" onClick={() => setDetailCustomer(customer)}>
                    <TableCell className="font-medium">{customer.full_name}</TableCell>
                    <TableCell>{customer.phone || "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">{customer.address || "—"}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {canManage && (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(customer)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(customer)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit customer" : "Add customer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Add customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete customer?"
        description="This cannot be undone. Existing orders will keep their history but lose the customer link."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) return handleDelete(deleteTarget);
        }}
      />

      <CustomerDetailDialog customer={detailCustomer} onOpenChange={(open) => !open && setDetailCustomer(null)} />
    </div>
  );
}
