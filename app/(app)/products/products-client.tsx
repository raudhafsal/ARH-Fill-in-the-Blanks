"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { Product, Category, RecipeItem, ProductUnit, ProductVariantGroup } from "@/types/database";
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
import { Plus, Pencil, Trash2, Package, Loader2, Search, ArrowUpDown, ChefHat, X, Ruler, Layers, Star, FileUp } from "lucide-react";
import { CsvImportDialog } from "./csv-import-dialog";
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
  variant_group_id: z.string().nullable(),
  variant_name: z.string().trim().max(100).optional(),
  new_group_name: z.string().trim().max(100).optional(),
}).refine((v) => v.variant_group_id !== "__new__" || (v.new_group_name && v.new_group_name.length > 0), {
  message: "Group name is required",
  path: ["new_group_name"],
}).refine((v) => !v.variant_group_id || (v.variant_name && v.variant_name.length > 0), {
  message: "Variant name is required (e.g. \"With Jelly\")",
  path: ["variant_name"],
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
  variant_group_id: string | null;
  variant_name: string;
  new_group_name: string;
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
  variant_group_id: null,
  variant_name: "",
  new_group_name: "",
};

type SortKey = "name" | "selling_price" | "current_stock";

interface RecipeRow {
  ingredient_product_id: string;
  quantity: string;
}

interface UnitRow {
  id?: string;
  name: string;
  scale: string;
  is_default: boolean;
}

const quickCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
});

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
  initialVariantGroups,
}: {
  initialProducts: Product[];
  categories: Category[];
  initialVariantGroups: ProductVariantGroup[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categoryList, setCategoryList] = useState<Category[]>(categories);
  const [variantGroupList, setVariantGroupList] = useState<ProductVariantGroup[]>(initialVariantGroups);
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

  const [recipeItems, setRecipeItems] = useState<RecipeRow[]>([]);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [recipeProductIds, setRecipeProductIds] = useState<Set<string>>(new Set());

  const [unitRows, setUnitRows] = useState<UnitRow[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);

  const [csvDialogOpen, setCsvDialogOpen] = useState(false);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: "" });
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categorySaving, setCategorySaving] = useState(false);

  const categoryMap = useMemo(() => new Map(categoryList.map((c) => [c.id, c.name])), [categoryList]);
  const unitMap = useMemo(() => new Map(products.map((p) => [p.id, p.unit])), [products]);
  const variantGroupMap = useMemo(() => new Map(variantGroupList.map((g) => [g.id, g.name])), [variantGroupList]);

  function addUnitRow() {
    setUnitRows((rows) => [...rows, { name: "", scale: "1", is_default: false }]);
  }

  function updateUnitRow(index: number, patch: Partial<UnitRow>) {
    setUnitRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeUnitRow(index: number) {
    setUnitRows((rows) => rows.filter((_, i) => i !== index));
  }

  function setDefaultUnitRow(index: number) {
    setUnitRows((rows) => rows.map((r, i) => ({ ...r, is_default: i === index })));
  }

  async function refreshRecipeProductIds() {
    const { data } = await supabase.from("recipe_items").select("product_id");
    setRecipeProductIds(new Set((data ?? []).map((r) => r.product_id as string)));
  }

  async function refresh() {
    const [{ data }, { data: categoryData }] = await Promise.all([
      supabase.from("products").select("*").order("name", { ascending: true }),
      supabase.from("categories").select("*").order("display_order", { ascending: true }),
    ]);
    setProducts((data ?? []) as Product[]);
    setCategoryList((categoryData ?? []) as Category[]);
    await refreshRecipeProductIds();
  }

  useEffect(() => {
    refreshRecipeProductIds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addRecipeRow() {
    setRecipeItems((rows) => [...rows, { ingredient_product_id: "", quantity: "1" }]);
  }

  function updateRecipeRow(index: number, patch: Partial<RecipeRow>) {
    setRecipeItems((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRecipeRow(index: number) {
    setRecipeItems((rows) => rows.filter((_, i) => i !== index));
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setRecipeItems([]);
    setUnitRows([]);
    setDialogOpen(true);
  }

  async function openEdit(product: Product) {
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
      variant_group_id: product.variant_group_id,
      variant_name: product.variant_name ?? "",
      new_group_name: "",
    });
    setErrors({});
    setRecipeItems([]);
    setUnitRows([]);
    setDialogOpen(true);
    setRecipeLoading(true);
    setUnitsLoading(true);
    try {
      const [{ data: recipeData }, { data: unitData }] = await Promise.all([
        supabase.from("recipe_items").select("*").eq("product_id", product.id),
        supabase.from("product_units").select("*").eq("product_id", product.id).order("scale", { ascending: true }),
      ]);
      setRecipeItems(
        ((recipeData ?? []) as RecipeItem[]).map((r) => ({
          ingredient_product_id: r.ingredient_product_id,
          quantity: String(r.quantity),
        }))
      );
      setUnitRows(
        ((unitData ?? []) as ProductUnit[]).map((u) => ({
          id: u.id,
          name: u.name,
          scale: String(u.scale),
          is_default: u.is_default,
        }))
      );
    } finally {
      setRecipeLoading(false);
      setUnitsLoading(false);
    }
  }

  async function saveRecipeItems(productId: string) {
    const validRows = recipeItems.filter((r) => r.ingredient_product_id && Number(r.quantity) > 0);
    const { error: delError } = await supabase.from("recipe_items").delete().eq("product_id", productId);
    if (delError) throw delError;
    if (validRows.length > 0) {
      const { error: insError } = await supabase.from("recipe_items").insert(
        validRows.map((r) => ({
          product_id: productId,
          ingredient_product_id: r.ingredient_product_id,
          quantity: Number(r.quantity),
        }))
      );
      if (insError) throw insError;
    }
  }

  async function saveUnitRows(productId: string) {
    const validRows = unitRows.filter((r) => r.name.trim() && Number(r.scale) > 0);
    const { error: delError } = await supabase.from("product_units").delete().eq("product_id", productId);
    if (delError) throw delError;
    if (validRows.length > 0) {
      const { error: insError } = await supabase.from("product_units").insert(
        validRows.map((r) => ({
          product_id: productId,
          name: r.name.trim(),
          scale: Number(r.scale),
          is_default: r.is_default,
        }))
      );
      if (insError) throw insError;
    }
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
    const dupUnitNames = new Set<string>();
    for (const r of unitRows) {
      const n = r.name.trim().toLowerCase();
      if (!n) continue;
      if (dupUnitNames.has(n)) {
        setErrors({ units: "Unit names must be unique for this product." });
        return;
      }
      dupUnitNames.add(n);
    }
    setErrors({});
    setSaving(true);
    try {
      let variantGroupId: string | null = result.data.variant_group_id;
      if (variantGroupId === "__new__") {
        const { data: groupData, error: groupError } = await supabase
          .from("product_variant_groups")
          .insert({
            name: result.data.new_group_name!.trim(),
            category_id: result.data.category_id || null,
            image_url: result.data.image_url || null,
          })
          .select()
          .single();
        if (groupError) throw groupError;
        const newGroup = groupData as ProductVariantGroup;
        setVariantGroupList((prev) => [...prev, newGroup].sort((a, b) => a.name.localeCompare(b.name)));
        variantGroupId = newGroup.id;
      }

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
        variant_group_id: variantGroupId || null,
        variant_name: variantGroupId ? result.data.variant_name!.trim() : null,
      };
      let productId = editing?.id;
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select().single();
        if (error) throw error;
        productId = data.id;
      }
      if (productId) {
        await saveRecipeItems(productId);
        await saveUnitRows(productId);
      }
      toast.success(editing ? "Product updated." : "Product created.");
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
      const { data, error } = await supabase
        .from("categories")
        .insert({ name: result.data.name })
        .select()
        .single();
      if (error) throw error;
      const newCategory = data as Category;
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCsvDialogOpen(true)}>
              <FileUp className="h-4 w-4" />
              Import CSV
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New product
            </Button>
          </div>
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
              {categoryList.map((c) => (
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
                          <div className="flex items-center gap-1.5">
                            <p className="truncate font-medium">{product.name}</p>
                            {recipeProductIds.has(product.id) && (
                              <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]">
                                <ChefHat className="h-2.5 w-2.5" />
                                Recipe
                              </Badge>
                            )}
                          </div>
                          {product.variant_group_id && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Layers className="h-2.5 w-2.5" />
                              <span className="truncate">
                                {variantGroupMap.get(product.variant_group_id) ?? "Group"} · {product.variant_name}
                              </span>
                            </div>
                          )}
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
                <div className="flex gap-2">
                  <Select
                    value={form.category_id ?? "none"}
                    onValueChange={(v) => setForm((f) => ({ ...f, category_id: v === "none" ? null : v }))}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="No category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No category</SelectItem>
                      {categoryList.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" onClick={openCategoryCreate} aria-label="Quick add category">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
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

            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ruler className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Units of measurement</p>
                    <p className="text-xs text-muted-foreground">
                      Stock is always counted in the base unit above ({form.unit || "unit"}). Add other units you buy
                      or sell in — e.g. a "Case" of 100 pcs — and purchases can convert automatically.
                    </p>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addUnitRow} disabled={unitsLoading}>
                  <Plus className="h-3.5 w-3.5" />
                  Add unit
                </Button>
              </div>

              {errors.units && <p className="text-sm text-destructive">{errors.units}</p>}

              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-28">Scale</TableHead>
                      <TableHead className="w-20">Default</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">{form.unit || "Base unit"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">1 (base)</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]">
                          Base unit
                        </Badge>
                      </TableCell>
                      <TableCell />
                    </TableRow>
                    {unitsLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-3 text-center text-sm text-muted-foreground">
                          Loading units...
                        </TableCell>
                      </TableRow>
                    ) : (
                      unitRows.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Input
                              value={row.name}
                              onChange={(e) => updateUnitRow(i, { name: e.target.value })}
                              placeholder="Eg: case, box, dozen..."
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Input
                                type="number"
                                min="0.0001"
                                step="any"
                                value={row.scale}
                                onChange={(e) => updateUnitRow(i, { scale: e.target.value })}
                              />
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              1 {row.name || "unit"} = {row.scale || "0"} {form.unit || "base"}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant={row.is_default ? "default" : "outline"}
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setDefaultUnitRow(i)}
                              aria-label="Set as default unit"
                            >
                              <Star className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => removeUnitRow(i)}
                              aria-label="Remove unit"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Variant</p>
                  <p className="text-xs text-muted-foreground">
                    For items that come in a few versions sharing one name, e.g. "Jugo Juice" with "With Jelly" /
                    "Without Jelly" — each variant keeps its own stock, price and SKU.
                  </p>
                </div>
              </div>

              <Select
                value={form.variant_group_id ?? "none"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    variant_group_id: v === "none" ? null : v,
                    new_group_name: v === "__new__" ? f.new_group_name : "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not a variant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not a variant</SelectItem>
                  {variantGroupList.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new__">+ New group...</SelectItem>
                </SelectContent>
              </Select>

              {form.variant_group_id === "__new__" && (
                <div className="space-y-1">
                  <Label htmlFor="p-new-group">New group name</Label>
                  <Input
                    id="p-new-group"
                    value={form.new_group_name}
                    onChange={(e) => setForm((f) => ({ ...f, new_group_name: e.target.value }))}
                    placeholder="Eg: Jugo Juice"
                  />
                  {errors.new_group_name && <p className="text-sm text-destructive">{errors.new_group_name}</p>}
                </div>
              )}

              {form.variant_group_id && (
                <div className="space-y-1">
                  <Label htmlFor="p-variant-name">This variant's name</Label>
                  <Input
                    id="p-variant-name"
                    value={form.variant_name}
                    onChange={(e) => setForm((f) => ({ ...f, variant_name: e.target.value }))}
                    placeholder="Eg: With Jelly"
                  />
                  {errors.variant_name && <p className="text-sm text-destructive">{errors.variant_name}</p>}
                </div>
              )}
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

            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ChefHat className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Recipe (ingredients)</p>
                    <p className="text-xs text-muted-foreground">
                      For a made item like a juice — list what it consumes. Selling it automatically deducts each
                      ingredient's own stock.
                    </p>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addRecipeRow} disabled={recipeLoading}>
                  <Plus className="h-3.5 w-3.5" />
                  Add ingredient
                </Button>
              </div>

              {recipeLoading ? (
                <p className="py-2 text-center text-sm text-muted-foreground">Loading recipe...</p>
              ) : recipeItems.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  No ingredients yet — this product's own stock (if tracked) will be deducted as usual.
                </p>
              ) : (
                <div className="space-y-2">
                  {recipeItems.map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Select
                        value={row.ingredient_product_id || undefined}
                        onValueChange={(v) => updateRecipeRow(i, { ingredient_product_id: v })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select ingredient product..." />
                        </SelectTrigger>
                        <SelectContent>
                          {products
                            .filter((p) => p.id !== editing?.id)
                            .map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        step="0.0001"
                        className="w-24"
                        value={row.quantity}
                        onChange={(e) => updateRecipeRow(i, { quantity: e.target.value })}
                      />
                      <span className="w-10 shrink-0 text-xs text-muted-foreground">
                        {unitMap.get(row.ingredient_product_id) ?? ""}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => removeRecipeRow(i)}
                        aria-label="Remove ingredient"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">Quantities are per 1 {form.unit || "unit"} sold.</p>
                </div>
              )}
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
        title="Delete product?"
        description={`This will permanently delete "${deleteTarget?.name}".`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />

      <CsvImportDialog
        open={csvDialogOpen}
        onOpenChange={setCsvDialogOpen}
        categories={categoryList}
        onImported={refresh}
      />
    </div>
  );
}
