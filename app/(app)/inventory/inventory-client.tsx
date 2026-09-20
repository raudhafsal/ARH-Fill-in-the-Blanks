"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { Product, InventoryTxnType } from "@/types/database";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Boxes, AlertTriangle, XCircle, Loader2, PackageSearch, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { cn, formatMVR, formatMaldivesDateTime, round2 } from "@/lib/utils";

type MovementRow = {
  id: string;
  type: InventoryTxnType;
  quantity_change: number;
  resulting_stock: number;
  reason: string | null;
  notes: string | null;
  created_at: string;
  product: { name: string } | null;
  creator: { full_name: string } | null;
};

const ADJUSTMENT_TYPES: { value: InventoryTxnType; label: string }[] = [
  { value: "adjustment", label: "Adjustment" },
  { value: "damaged", label: "Damaged" },
  { value: "wasted", label: "Wasted" },
  { value: "returned", label: "Returned" },
  { value: "manual_correction", label: "Manual correction" },
];

const adjustSchema = z.object({
  product_id: z.string().min(1, "Select a product"),
  type: z.string().min(1),
  direction: z.enum(["increase", "decrease"]),
  quantity: z.coerce.number().positive("Must be greater than 0"),
  reason: z.string().trim().min(1, "Reason is required"),
  notes: z.string().trim().optional(),
});

const PAGE_SIZE = 25;

function stockStatus(product: Product): "out" | "low" | "ok" {
  if (product.current_stock <= 0) return "out";
  if (product.current_stock <= product.minimum_stock) return "low";
  return "ok";
}

export function InventoryClient({ initialProducts }: { initialProducts: Product[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [movementsOffset, setMovementsOffset] = useState(0);
  const [movementsHasMore, setMovementsHasMore] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    product_id: "",
    type: "adjustment",
    direction: "increase" as "increase" | "decrease",
    quantity: "",
    reason: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function refreshProducts() {
    const { data } = await supabase.from("products").select("*").eq("track_inventory", true).order("name", { ascending: true });
    setProducts((data ?? []) as Product[]);
  }

  async function loadMovements(offset: number) {
    setMovementsLoading(true);
    try {
      const { data, error } = await supabase
        .from("inventory_transactions")
        .select("id,type,quantity_change,resulting_stock,reason,notes,created_at,product:products(name),creator:profiles(full_name)")
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      const rows = (data ?? []) as unknown as MovementRow[];
      setMovements((prev) => (offset === 0 ? rows : [...prev, ...rows]));
      setMovementsHasMore(rows.length === PAGE_SIZE);
      setMovementsOffset(offset + rows.length);
    } catch {
      toast.error("Unable to load stock movements.");
    } finally {
      setMovementsLoading(false);
    }
  }

  useEffect(() => {
    loadMovements(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return products;
    return products.filter((p) => stockStatus(p) === statusFilter);
  }, [products, statusFilter]);

  const lowCount = products.filter((p) => stockStatus(p) === "low").length;
  const outCount = products.filter((p) => stockStatus(p) === "out").length;
  const totalValue = products.reduce((s, p) => s + p.current_stock * p.cost_price, 0);

  function openAdjust(productId?: string) {
    setForm({ product_id: productId ?? "", type: "adjustment", direction: "increase", quantity: "", reason: "", notes: "" });
    setErrors({});
    setDialogOpen(true);
  }

  async function handleSubmit() {
    const result = adjustSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const signedQuantity = result.data.direction === "increase" ? result.data.quantity : -result.data.quantity;
      const { error } = await supabase.rpc("adjust_stock", {
        p_product_id: result.data.product_id,
        p_type: result.data.type,
        p_quantity: round2(signedQuantity),
        p_reason: result.data.reason,
        p_notes: result.data.notes || null,
      });
      if (error) throw error;
      toast.success("Stock adjusted.");
      setDialogOpen(false);
      await Promise.all([refreshProducts(), loadMovements(0)]);
    } catch {
      toast.error("Unable to adjust stock. Please check the details and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Track stock levels and record adjustments."
        actions={
          <Button onClick={() => openAdjust()}>
            <Plus className="h-4 w-4" />
            Adjust stock
          </Button>
        }
      />

      <div className="space-y-6 p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Stock value" value={formatMVR(totalValue)} icon={Boxes} />
          <StatCard label="Low stock" value={String(lowCount)} icon={AlertTriangle} tone="warning" />
          <StatCard label="Out of stock" value={String(outCount)} icon={XCircle} tone="destructive" />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Stock overview</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                <SelectItem value="low">Low stock</SelectItem>
                <SelectItem value="out">Out of stock</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <EmptyState icon={PackageSearch} title="No products match this filter" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Current stock</TableHead>
                    <TableHead>Minimum</TableHead>
                    <TableHead>Stock value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((product) => {
                    const status = stockStatus(product);
                    return (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>
                          {product.current_stock} {product.unit}
                        </TableCell>
                        <TableCell>
                          {product.minimum_stock} {product.unit}
                        </TableCell>
                        <TableCell>{formatMVR(product.current_stock * product.cost_price)}</TableCell>
                        <TableCell>
                          {status === "out" && <Badge variant="destructive">Out of stock</Badge>}
                          {status === "low" && <Badge variant="warning">Low</Badge>}
                          {status === "ok" && <Badge variant="secondary">OK</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => openAdjust(product.id)}>
                            Adjust
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stock movements</CardTitle>
          </CardHeader>
          <CardContent>
            {movements.length === 0 && !movementsLoading ? (
              <EmptyState icon={Boxes} title="No stock movements yet" />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead>Resulting stock</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatMaldivesDateTime(m.created_at)}
                        </TableCell>
                        <TableCell>{m.product?.name ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {m.type.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className={cn(m.quantity_change < 0 ? "text-destructive" : "text-success")}>
                          {m.quantity_change > 0 ? "+" : ""}
                          {m.quantity_change}
                        </TableCell>
                        <TableCell>{m.resulting_stock}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{m.reason ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.creator?.full_name ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-3 flex justify-center">
                  {movementsHasMore && (
                    <Button variant="outline" size="sm" disabled={movementsLoading} onClick={() => loadMovements(movementsOffset)}>
                      {movementsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Load more
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Product</Label>
              <Select value={form.product_id} onValueChange={(v) => setForm((f) => ({ ...f, product_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.product_id && <p className="text-sm text-destructive">{errors.product_id}</p>}
            </div>

            {form.product_id && (
              <p className="text-sm text-muted-foreground">
                Current stock:{" "}
                <span className="font-medium text-foreground">
                  {products.find((p) => p.id === form.product_id)?.current_stock ?? 0}{" "}
                  {products.find((p) => p.id === form.product_id)?.unit}
                </span>
              </p>
            )}

            <div className="space-y-2">
              <Label>Adjustment type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quantity change</Label>
              <div className="flex gap-2">
                <div className="flex rounded-md border">
                  <button
                    type="button"
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-l-md",
                      form.direction === "increase" ? "bg-success text-success-foreground" : "hover:bg-accent"
                    )}
                    onClick={() => setForm((f) => ({ ...f, direction: "increase" }))}
                    aria-label="Increase"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-r-md border-l",
                      form.direction === "decrease" ? "bg-destructive text-destructive-foreground" : "hover:bg-accent"
                    )}
                    onClick={() => setForm((f) => ({ ...f, direction: "decrease" }))}
                    aria-label="Decrease"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                </div>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  placeholder="Enter a positive number"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {form.direction === "increase" ? "This will increase" : "This will decrease"} stock by the quantity entered.
              </p>
              {errors.quantity && <p className="text-sm text-destructive">{errors.quantity}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="adj-reason">Reason</Label>
              <Input
                id="adj-reason"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. Stock count correction"
              />
              {errors.reason && <p className="text-sm text-destructive">{errors.reason}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="adj-notes">Notes (optional)</Label>
              <Textarea
                id="adj-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
