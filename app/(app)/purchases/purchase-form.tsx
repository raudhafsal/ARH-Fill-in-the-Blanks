"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { Supplier, Product, Purchase, PurchaseItem } from "@/types/database";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { formatMVR, round2 } from "@/lib/utils";

const quickSupplierSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().max(150).optional(),
});

const quickProductSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  unit: z.string().trim().min(1, "Unit is required").max(30),
  cost_price: z.coerce.number().min(0, "Must be 0 or more"),
  selling_price: z.coerce.number().min(0, "Must be 0 or more"),
});

type LineItem = {
  key: string;
  product_id: string;
  quantity: string;
  cost_price: string;
};

function newLine(): LineItem {
  return { key: crypto.randomUUID(), product_id: "", quantity: "1", cost_price: "0" };
}

const headerSchema = z.object({
  supplier_id: z.string().min(1, "Select a supplier"),
  invoice_number: z.string().trim().optional(),
  purchase_date: z.string().min(1, "Purchase date is required"),
  notes: z.string().trim().optional(),
});

export function PurchaseForm({
  mode,
  suppliers,
  products,
  existingPurchase,
  existingItems,
}: {
  mode: "create" | "edit";
  suppliers: Supplier[];
  products: Product[];
  existingPurchase?: Purchase;
  existingItems?: PurchaseItem[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [supplierList, setSupplierList] = useState<Supplier[]>(suppliers);
  const [productList, setProductList] = useState<Product[]>(products);

  const [supplierId, setSupplierId] = useState(existingPurchase?.supplier_id ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(existingPurchase?.invoice_number ?? "");
  const [purchaseDate, setPurchaseDate] = useState(
    existingPurchase?.purchase_date ?? new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState(existingPurchase?.notes ?? "");
  const [lines, setLines] = useState<LineItem[]>(
    existingItems && existingItems.length > 0
      ? existingItems.map((i) => ({
          key: i.id,
          product_id: i.product_id,
          quantity: String(i.quantity),
          cost_price: String(i.cost_price),
        }))
      : [newLine()]
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", email: "" });
  const [supplierErrors, setSupplierErrors] = useState<Record<string, string>>({});
  const [supplierSaving, setSupplierSaving] = useState(false);

  const [productDialogLineKey, setProductDialogLineKey] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({ name: "", unit: "pc", cost_price: "0", selling_price: "0" });
  const [productErrors, setProductErrors] = useState<Record<string, string>>({});
  const [productSaving, setProductSaving] = useState(false);

  const productMap = useMemo(() => new Map(productList.map((p) => [p.id, p])), [productList]);

  function openSupplierCreate() {
    setSupplierForm({ name: "", phone: "", email: "" });
    setSupplierErrors({});
    setSupplierDialogOpen(true);
  }

  async function handleCreateSupplier() {
    const result = quickSupplierSchema.safeParse(supplierForm);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      setSupplierErrors(fieldErrors);
      return;
    }
    setSupplierErrors({});
    setSupplierSaving(true);
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .insert({
          name: result.data.name,
          phone: result.data.phone || null,
          email: result.data.email || null,
        })
        .select()
        .single();
      if (error) throw error;
      setSupplierList((prev) => [...prev, data as Supplier].sort((a, b) => a.name.localeCompare(b.name)));
      setSupplierId(data.id);
      toast.success("Supplier added.");
      setSupplierDialogOpen(false);
    } catch {
      toast.error("Unable to add supplier. Please try again.");
    } finally {
      setSupplierSaving(false);
    }
  }

  function openProductCreate(lineKey: string) {
    setProductForm({ name: "", unit: "pc", cost_price: "0", selling_price: "0" });
    setProductErrors({});
    setProductDialogLineKey(lineKey);
  }

  async function handleCreateProduct() {
    const result = quickProductSchema.safeParse(productForm);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      setProductErrors(fieldErrors);
      return;
    }
    setProductErrors({});
    setProductSaving(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .insert({
          name: result.data.name,
          unit: result.data.unit,
          cost_price: result.data.cost_price,
          selling_price: result.data.selling_price,
        })
        .select()
        .single();
      if (error) throw error;
      const newProduct = data as Product;
      setProductList((prev) => [...prev, newProduct].sort((a, b) => a.name.localeCompare(b.name)));
      if (productDialogLineKey) {
        onProductSelectFor(productDialogLineKey, newProduct);
      }
      toast.success("Product added.");
      setProductDialogLineKey(null);
    } catch {
      toast.error("Unable to add product. Please try again.");
    } finally {
      setProductSaving(false);
    }
  }

  function updateLine(key: string, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }

  function onProductSelect(key: string, productId: string) {
    const product = productMap.get(productId);
    updateLine(key, { product_id: productId, cost_price: product ? String(product.cost_price) : "0" });
  }

  function onProductSelectFor(key: string, product: Product) {
    updateLine(key, { product_id: product.id, cost_price: String(product.cost_price) });
  }

  const lineTotals = lines.map((l) => round2(Number(l.quantity || 0) * Number(l.cost_price || 0)));
  const grandTotal = round2(lineTotals.reduce((s, t) => s + t, 0));

  async function handleSubmit() {
    const headerResult = headerSchema.safeParse({
      supplier_id: supplierId,
      invoice_number: invoiceNumber,
      purchase_date: purchaseDate,
      notes,
    });
    const fieldErrors: Record<string, string> = {};
    if (!headerResult.success) {
      for (const issue of headerResult.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    }
    const validLines = lines.filter((l) => l.product_id);
    if (validLines.length === 0) {
      fieldErrors.lines = "Add at least one product line.";
    }
    for (const l of lines) {
      if (l.product_id && (Number(l.quantity) <= 0 || Number.isNaN(Number(l.quantity)))) {
        fieldErrors.lines = "Every line needs a quantity greater than 0.";
      }
      if (l.product_id && (Number(l.cost_price) < 0 || Number.isNaN(Number(l.cost_price)))) {
        fieldErrors.lines = "Cost price can't be negative.";
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      let purchaseId = existingPurchase?.id;
      const purchasePayload = {
        supplier_id: supplierId,
        invoice_number: invoiceNumber || null,
        purchase_date: purchaseDate,
        notes: notes || null,
        total_cost: grandTotal,
      };

      if (mode === "edit" && purchaseId) {
        const { error } = await supabase.from("purchases").update(purchasePayload).eq("id", purchaseId);
        if (error) throw error;
        const { error: delError } = await supabase.from("purchase_items").delete().eq("purchase_id", purchaseId);
        if (delError) throw delError;
      } else {
        const { data, error } = await supabase.from("purchases").insert({ ...purchasePayload, status: "draft" }).select("id").single();
        if (error) throw error;
        purchaseId = data.id;
      }

      const itemsPayload = validLines.map((l, idx) => ({
        purchase_id: purchaseId,
        product_id: l.product_id,
        quantity: Number(l.quantity),
        cost_price: Number(l.cost_price),
        total_cost: lineTotals[lines.indexOf(l)],
      }));
      const { error: itemsError } = await supabase.from("purchase_items").insert(itemsPayload);
      if (itemsError) throw itemsError;

      toast.success(mode === "edit" ? "Purchase updated." : "Purchase created as draft.");
      router.push("/purchases");
      router.refresh();
    } catch {
      toast.error("Unable to save purchase. Please check the details and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={mode === "edit" ? "Edit purchase" : "New purchase"}
        description="Draft purchases have no effect on stock until received."
        actions={
          <Button variant="outline" onClick={() => router.push("/purchases")}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        }
      />

      <div className="space-y-6 p-4 sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <div className="flex gap-2">
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {supplierList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={openSupplierCreate} aria-label="New supplier">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {errors.supplier_id && <p className="text-sm text-destructive">{errors.supplier_id}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-num">Invoice number</Label>
              <Input id="inv-num" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pur-date">Purchase date</Label>
              <Input id="pur-date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
              {errors.purchase_date && <p className="text-sm text-destructive">{errors.purchase_date}</p>}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="pur-notes">Notes</Label>
              <Textarea id="pur-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Line items</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, newLine()])}>
              <Plus className="h-3.5 w-3.5" />
              Add line
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {errors.lines && <p className="text-sm text-destructive">{errors.lines}</p>}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Product</TableHead>
                    <TableHead className="w-28">Quantity</TableHead>
                    <TableHead className="w-32">Cost price</TableHead>
                    <TableHead className="w-32 text-right">Line total</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l, idx) => (
                    <TableRow key={l.key}>
                      <TableCell>
                        <div className="flex gap-2">
                        <Select value={l.product_id} onValueChange={(v) => onProductSelect(l.key, v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {productList.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          onClick={() => openProductCreate(l.key)}
                          aria-label="New product"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.quantity}
                          onChange={(e) => updateLine(l.key, { quantity: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.cost_price}
                          onChange={(e) => updateLine(l.key, { cost_price: e.target.value })}
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatMVR(lineTotals[idx])}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          disabled={lines.length === 1}
                          onClick={() => removeLine(l.key)}
                          aria-label="Remove line"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end border-t pt-3 text-base font-semibold">Total: {formatMVR(grandTotal)}</div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.push("/purchases")} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "edit" ? "Save changes" : "Save as draft"}
          </Button>
        </div>
      </div>

      <Dialog open={supplierDialogOpen} onOpenChange={(open) => !supplierSaving && setSupplierDialogOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New supplier</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="qs-name">Name</Label>
              <Input
                id="qs-name"
                value={supplierForm.name}
                onChange={(e) => setSupplierForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
              {supplierErrors.name && <p className="text-sm text-destructive">{supplierErrors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="qs-phone">Phone</Label>
              <Input id="qs-phone" value={supplierForm.phone} onChange={(e) => setSupplierForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qs-email">Email</Label>
              <Input id="qs-email" value={supplierForm.email} onChange={(e) => setSupplierForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <p className="text-xs text-muted-foreground">
              You can add contact details, address and notes later from the Suppliers tab.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplierDialogOpen(false)} disabled={supplierSaving}>
              Cancel
            </Button>
            <Button onClick={handleCreateSupplier} disabled={supplierSaving}>
              {supplierSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Add supplier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!productDialogLineKey} onOpenChange={(open) => !productSaving && !open && setProductDialogLineKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="qp-name">Name</Label>
              <Input
                id="qp-name"
                value={productForm.name}
                onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
              {productErrors.name && <p className="text-sm text-destructive">{productErrors.name}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="qp-unit">Unit</Label>
                <Input
                  id="qp-unit"
                  value={productForm.unit}
                  onChange={(e) => setProductForm((f) => ({ ...f, unit: e.target.value }))}
                  placeholder="pc, kg..."
                />
                {productErrors.unit && <p className="text-sm text-destructive">{productErrors.unit}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="qp-cost">Cost price</Label>
                <Input
                  id="qp-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.cost_price}
                  onChange={(e) => setProductForm((f) => ({ ...f, cost_price: e.target.value }))}
                />
                {productErrors.cost_price && <p className="text-sm text-destructive">{productErrors.cost_price}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="qp-price">Selling price</Label>
                <Input
                  id="qp-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.selling_price}
                  onChange={(e) => setProductForm((f) => ({ ...f, selling_price: e.target.value }))}
                />
                {productErrors.selling_price && <p className="text-sm text-destructive">{productErrors.selling_price}</p>}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              You can set a category, image, tax and stock levels later from the Products page.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogLineKey(null)} disabled={productSaving}>
              Cancel
            </Button>
            <Button onClick={handleCreateProduct} disabled={productSaving}>
              {productSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Add product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
