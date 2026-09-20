"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { Product, Category } from "@/types/database";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ImageUpload } from "@/components/shared/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Package, Loader2, Search, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { cn, formatMVR } from "@/lib/utils";

const productSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  sku: z.string().trim().max(60).optional(),
  barcode: z.string().trim().max(60).optional(),
  category_id: z.string().nullable(),
  description: z.string().trim().max(1000).optional(),
  selling_price: z.coerce.number().min(0, "Must be 0 or more"),
  cost_price: z.coerce.number().min(0, "Must be 0 or more"),
  current_stock: z.coerce.number().min(0, "Must be 0 or more"),
  minimum_stock: z.coerce.number().min(0, "Must be 0 or more"),
  unit: z.string().trim().min(1, "Unit is required").max(30),
  image_url: z.string().nullable().optional(),
  active: z.boolean(),
  track_inventory: z.boolean(),
  tax_enabled: z.boolean(),
  tax_rate: z.coerce.number().min(0, "Must be 0 or more"),
});

type ProductFormValues = {
  name: string;
  sku: string;
  barcode: string;
  category_id: string | null;
  description: string;
  selling_price: string;
  cost_price: string;
  current_stock: string;
  minimum_stock: string;
  unit: string;
  image_url: string | null;
  active: boolean;
  track_inventory: boolean;
  tax_enabled: boolean;
  tax_rate: string;
};

const emptyForm: ProductFormValues = {
  name: "",
  sku: "",
  barcode: "",
  category_id: null,
  description: "",
  selling_price: "0",
  cost_price: "0",
  current_stock: "0",
  minimum_stock: "0",
  unit: "pc",
  image_url: null,
  active: true,
  track_inventory: true,
  tax_enabled: false,
  tax_rate: "0",
};

type SortKey = "name" | "selling_price" | "current_stock";

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function ProductsClient({
  initialProducts,
  categories,
}: {
  initialProducts: Product[];
  categories: Category[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormValues>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteChecking, setDeleteChecking] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  async function refresh() {
    const { data } = await supabase.from("products").select("*").order("name", { ascending: true });
    setProducts((data ?? []) as Product[]);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setDialogOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({
      name: product.name,
      sku: product.sku ?? "",
      barcode: product.barcode ?? "",
      category_id: product.category_id,
      description: product.description ?? "",
      selling_price: String(product.selling_price),
      cost_price: String(product.cost_price),
      current_stock: String(product.current_stock),
      minimum_stock: String(product.minimum_stock),
      unit: product.unit,
      image_url: product.image_url,
      active: product.active,
      track_inventory: product.track_inventory,
      tax_enabled: product.tax_enabled,
      tax_rate: String(product.tax_rate),
    });
    setErrors({});
    setDialogOpen(true);
  }

  async function handleSubmit() {
    const result = productSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const payload = {
        name: result.data.name,
        sku: result.data.sku || null,
        barcode: result.data.barcode || null,
        category_id: result.data.category_id || null,
        description: result.data.description || null,
        selling_price: result.data.selling_price,
        cost_price: result.data.cost_price,
        current_stock: result.data.current_stock,
        minimum_stock: result.data.minimum_stock,
        unit: result.data.unit,
        image_url: result.data.image_url || null,
        active: result.data.active,
        track_inventory: result.data.track_inventory,
        tax_enabled: result.data.tax_enabled,
        tax_rate: result.data.tax_rate,
      };
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Product updated.");
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
        toast.success("Product created.");
      }
      setDialogOpen(false);
      await refresh();
    } catch {
      toast.error("Unable to save product. Please check the details and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(product: Product) {
    setTogglingId(product.id);
    try {
      const { error } = await supabase.from("products").update({ active: !product.active }).eq("id", product.id);
      if (error) throw error;
      await refresh();
    } catch {
      toast.error("Unable to update product status.");
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmDeleteTarget(product: Product) {
    setDeleteChecking(true);
    try {
      const { count, error } = await supabase
        .from("order_items")
        .select("id", { count: "exact", head: true })
        .eq("product_id", product.id);
      if (error) throw error;
      if (count && count > 0) {
        toast.error("This product has order history and can't be deleted. Deactivate it instead.");
        setDeleteChecking(false);
        return;
      }
      setDeleteTarget(product);
    } catch {
      toast.error("Unable to check product history. Please try again.");
    } finally {
      setDeleteChecking(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from("products").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success("Product deleted.");
      await refresh();
    } catch {
      toast.error("Unable to delete product. Please try again.");
    } finally {
      setDeleteTarget(null);
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    let list = products;
    const q = debouncedSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku ?? "").toLowerCase().includes(q) ||
          (p.barcode ?? "").toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== "all") {
      list = list.filter((p) => p.category_id === categoryFilter);
    }
    if (statusFilter !== "all") {
      list = list.filter((p) => (statusFilter === "active" ? p.active : !p.active));
    }
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      if (sortKey === "selling_price") cmp = a.selling_price - b.selling_price;
      if (sortKey === "current_stock") cmp = a.current_stock - b.current_stock;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [products, debouncedSearch, categoryFilter, statusFilter, sortKey, sortDir]);

  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage your product catalog, pricing and stock."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New product
          </Button>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, SKU or barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="sm:w-48">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title={products.length === 0 ? "No products yet" : "No products match your filters"}
            description={products.length === 0 ? "Add your first product to get started." : "Try adjusting your search or filters."}
            action={
              products.length === 0 && (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  New product
                </Button>
              )
            }
          />
        ) : (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>
                    <button className="flex items-center gap-1" onClick={() => toggleSort("selling_price")}>
                      Price <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button className="flex items-center gap-1" onClick={() => toggleSort("current_stock")}>
                      Stock <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <button className="flex items-center gap-2 text-left" onClick={() => toggleSort("name")}>
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border bg-muted">
                          {product.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.image_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <Package className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{product.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {product.sku ? `SKU: ${product.sku}` : product.barcode ? `Barcode: ${product.barcode}` : "—"}
                          </p>
                        </div>
                      </button>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {product.category_id ? categoryMap.get(product.category_id) ?? "—" : "—"}
                    </TableCell>
                    <TableCell>{formatMVR(product.selling_price)}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          product.track_inventory && product.current_stock <= product.minimum_stock && "font-medium text-destructive"
                        )}
                      >
                        {product.current_stock} {product.unit}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={product.active}
                        disabled={togglingId === product.id}
                        onCheckedChange={() => handleToggleActive(product)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(product)} aria-label="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          disabled={deleteChecking}
                          onClick={() => confirmDeleteTarget(product)}
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
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Image</Label>
              <ImageUpload bucket="product-images" value={form.image_url} onChange={(url) => setForm((f) => ({ ...f, image_url: url }))} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="p-name">Name</Label>
                <Input id="p-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="p-sku">SKU</Label>
                <Input id="p-sku" value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-barcode">Barcode</Label>
                <Input
                  id="p-barcode"
                  value={form.barcode}
                  onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
                  placeholder="Scan or type manually"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Category</Label>
                <Select
                  value={form.category_id ?? "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, category_id: v === "none" ? null : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="p-desc">Description</Label>
                <Textarea
                  id="p-desc"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="p-price">Selling price (MVR)</Label>
                <Input
                  id="p-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.selling_price}
                  onChange={(e) => setForm((f) => ({ ...f, selling_price: e.target.value }))}
                />
                {errors.selling_price && <p className="text-sm text-destructive">{errors.selling_price}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-cost">Cost price (MVR)</Label>
                <Input
                  id="p-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost_price}
                  onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
                />
                {errors.cost_price && <p className="text-sm text-destructive">{errors.cost_price}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="p-stock">Current stock</Label>
                <Input
                  id="p-stock"
                  type="number"
                  min="0"
                  step="1"
                  value={form.current_stock}
                  onChange={(e) => setForm((f) => ({ ...f, current_stock: e.target.value }))}
                />
                {errors.current_stock && <p className="text-sm text-destructive">{errors.current_stock}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-minstock">Minimum stock</Label>
                <Input
                  id="p-minstock"
                  type="number"
                  min="0"
                  step="1"
                  value={form.minimum_stock}
                  onChange={(e) => setForm((f) => ({ ...f, minimum_stock: e.target.value }))}
                />
                {errors.minimum_stock && <p className="text-sm text-destructive">{errors.minimum_stock}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="p-unit">Unit</Label>
                <Input id="p-unit" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="pc, kg, ltr..." />
                {errors.unit && <p className="text-sm text-destructive">{errors.unit}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-tax">Tax rate (%)</Label>
                <Input
                  id="p-tax"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.tax_rate}
                  onChange={(e) => setForm((f) => ({ ...f, tax_rate: e.target.value }))}
                  disabled={!form.tax_enabled}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <p className="text-sm font-medium">Active</p>
                <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <p className="text-sm font-medium">Track inventory</p>
                <Switch checked={form.track_inventory} onCheckedChange={(v) => setForm((f) => ({ ...f, track_inventory: v }))} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <p className="text-sm font-medium">Tax enabled</p>
                <Switch checked={form.tax_enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, tax_enabled: v }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete product?"
        description={`This will permanently delete "${deleteTarget?.name}".`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}
