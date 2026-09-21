"use client";

import { useMemo, useState, useTransition } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { Expense, ExpenseCategory, PaymentMethod } from "@/types/database";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ReceiptUpload } from "./receipt-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMVR, formatMaldivesDate } from "@/lib/utils";
import { Plus, Pencil, Trash2, Wallet, Loader2 } from "lucide-react";
import { toast } from "sonner";

const expenseSchema = z.object({
  expense_date: z.string().min(1, "Date is required"),
  category_id: z.string().min(1, "Category is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  description: z.string().optional(),
  payment_method_id: z.string().min(1, "Payment method is required"),
  reference: z.string().optional(),
  attachment_url: z.string().nullable().optional(),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

const emptyForm: ExpenseForm = {
  expense_date: new Date().toISOString().slice(0, 10),
  category_id: "",
  amount: 0,
  description: "",
  payment_method_id: "",
  reference: "",
  attachment_url: null,
};

const quickCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
});

export function ExpensesClient({
  initialExpenses,
  categories,
  paymentMethods,
  initialFrom,
  initialTo,
  isAdmin,
}: {
  initialExpenses: Expense[];
  categories: ExpenseCategory[];
  paymentMethods: PaymentMethod[];
  initialFrom: string;
  initialTo: string;
  isAdmin: boolean;
}) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [categoryList, setCategoryList] = useState<ExpenseCategory[]>(categories);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseForm>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof ExpenseForm, string>>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [isPending, startTransition] = useTransition();

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: "" });
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categorySaving, setCategorySaving] = useState(false);

  const categoryMap = useMemo(() => new Map(categoryList.map((c) => [c.id, c.name])), [categoryList]);
  const paymentMap = useMemo(() => new Map(paymentMethods.map((p) => [p.id, p.name])), [paymentMethods]);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (categoryFilter !== "all" && e.category_id !== categoryFilter) return false;
      return true;
    });
  }, [expenses, categoryFilter]);

  const total = useMemo(() => filtered.reduce((sum, e) => sum + Number(e.amount), 0), [filtered]);

  async function refetch(newFrom: string, newTo: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .gte("expense_date", newFrom)
      .lte("expense_date", newTo)
      .order("expense_date", { ascending: false });
    if (error) {
      toast.error("Unable to load expenses.");
      return;
    }
    setExpenses((data ?? []) as Expense[]);
  }

  function applyDateFilter() {
    startTransition(() => {
      refetch(from, to);
    });
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setDialogOpen(true);
  }

  function openEdit(expense: Expense) {
    setEditing(expense);
    setForm({
      expense_date: expense.expense_date,
      category_id: expense.category_id ?? "",
      amount: expense.amount,
      description: expense.description ?? "",
      payment_method_id: expense.payment_method_id ?? "",
      reference: expense.reference ?? "",
      attachment_url: expense.attachment_url,
    });
    setErrors({});
    setDialogOpen(true);
  }

  async function handleSubmit() {
    const parsed = expenseSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof ExpenseForm, string>> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path[0] as keyof ExpenseForm] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        expense_date: parsed.data.expense_date,
        category_id: parsed.data.category_id,
        amount: parsed.data.amount,
        description: parsed.data.description || null,
        payment_method_id: parsed.data.payment_method_id,
        reference: parsed.data.reference || null,
        attachment_url: parsed.data.attachment_url || null,
      };

      if (editing) {
        const { error } = await supabase.from("expenses").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Expense updated.");
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const { error } = await supabase.from("expenses").insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
        toast.success("Expense recorded.");
      }
      setDialogOpen(false);
      await refetch(from, to);
    } catch {
      toast.error("Unable to save expense. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function openCategoryCreate() {
    setCategoryForm({ name: "" });
    setCategoryError(null);
    setCategoryDialogOpen(true);
  }

  async function handleCreateCategory() {
    const result = quickCategorySchema.safeParse(categoryForm);
    if (!result.success) {
      setCategoryError(result.error.issues[0]?.message ?? "Invalid name");
      return;
    }
    setCategoryError(null);
    setCategorySaving(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("expense_categories")
        .insert({ name: result.data.name })
        .select()
        .single();
      if (error) throw error;
      const newCategory = data as ExpenseCategory;
      setCategoryList((prev) => [...prev, newCategory].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((f) => ({ ...f, category_id: newCategory.id }));
      setCategoryDialogOpen(false);
      toast.success("Category created.");
    } catch {
      toast.error("Unable to create category. Please try again.");
    } finally {
      setCategorySaving(false);
    }
  }

  async function handleDelete(expense: Expense) {
    const supabase = createClient();
    const { error } = await supabase.from("expenses").delete().eq("id", expense.id);
    if (error) {
      toast.error("Unable to delete expense.");
      return;
    }
    toast.success("Expense deleted.");
    setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
  }

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Track business expenses and receipts."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add expense
          </Button>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="space-y-1">
              <Label htmlFor="from">From</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to">To</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categoryList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={applyDateFilter} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Apply
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Total (filtered range)" value={formatMVR(total)} icon={Wallet} />
          <StatCard label="Number of expenses" value={String(filtered.length)} />
          <StatCard
            label="Average expense"
            value={formatMVR(filtered.length ? total / filtered.length : 0)}
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Wallet} title="No expenses found" description="Try adjusting your filters or add a new expense." />
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Payment method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{formatMaldivesDate(expense.expense_date)}</TableCell>
                    <TableCell>{categoryMap.get(expense.category_id ?? "") ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">{expense.description || "—"}</TableCell>
                    <TableCell>{paymentMap.get(expense.payment_method_id ?? "") ?? "—"}</TableCell>
                    <TableCell>{expense.reference || "—"}</TableCell>
                    <TableCell className="text-right font-medium">{formatMVR(expense.amount)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(expense)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(expense)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
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
            <DialogTitle>{editing ? "Edit expense" : "Add expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="expense_date">Date</Label>
                <Input
                  id="expense_date"
                  type="date"
                  value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                />
                {errors.expense_date && <p className="text-xs text-destructive">{errors.expense_date}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="amount">Amount (MVR)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Category</Label>
              <div className="flex gap-2">
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryList.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isAdmin && (
                  <Button type="button" variant="outline" size="icon" onClick={openCategoryCreate} aria-label="Quick add category">
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {errors.category_id && <p className="text-xs text-destructive">{errors.category_id}</p>}
            </div>

            <div className="space-y-1">
              <Label>Payment method</Label>
              <Select value={form.payment_method_id} onValueChange={(v) => setForm({ ...form, payment_method_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a payment method" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.payment_method_id && <p className="text-xs text-destructive">{errors.payment_method_id}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="reference">Reference</Label>
              <Input
                id="reference"
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder="Invoice / receipt number"
              />
            </div>

            <div className="space-y-1">
              <Label>Receipt</Label>
              <ReceiptUpload value={form.attachment_url} onChange={(path) => setForm({ ...form, attachment_url: path })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Add expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryDialogOpen} onOpenChange={(open) => !categorySaving && setCategoryDialogOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="qc-name">Name</Label>
            <Input
              id="qc-name"
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ name: e.target.value })}
              autoFocus
            />
            {categoryError && <p className="text-sm text-destructive">{categoryError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)} disabled={categorySaving}>
              Cancel
            </Button>
            <Button onClick={handleCreateCategory} disabled={categorySaving}>
              {categorySaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete expense?"
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) return handleDelete(deleteTarget);
        }}
      />
    </div>
  );
}
