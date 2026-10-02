"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/types/database";
import { parseEwityVariantCsv, parseEwityVariantXlsx, variantLabel, type ParseResult } from "@/lib/csv-import";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Upload, Loader2, AlertTriangle, CheckCircle2, XCircle, FileUp } from "lucide-react";
import { toast } from "sonner";
import { formatMVR } from "@/lib/utils";

type GroupResult = { name: string; status: "pending" | "ok" | "error"; detail?: string; created: number };

export function CsvImportDialog({
  open,
  onOpenChange,
  categories,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onImported: () => Promise<void> | void;
}) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [groupResults, setGroupResults] = useState<GroupResult[] | null>(null);

  function reset() {
    setFileName(null);
    setResult(null);
    setGroupResults(null);
    setParsing(false);
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose(next: boolean) {
    if (importing) return;
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setParsing(true);
    setResult(null);
    setGroupResults(null);
    try {
      const isExcel = /\.xlsx?$/i.test(file.name) || file.type.includes("spreadsheet") || file.type.includes("excel");
      const parsed = isExcel
        ? await parseEwityVariantXlsx(await file.arrayBuffer())
        : parseEwityVariantCsv(await file.text());
      setResult(parsed);
    } catch {
      toast.error("Couldn't read that file. Make sure it's a CSV or Excel export from Ewity.");
      setFileName(null);
    } finally {
      setParsing(false);
    }
  }

  const existingCategoryMap = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));
  const newCategoryNames = result
    ? Array.from(
        new Set(
          result.groups
            .map((g) => g.categoryName)
            .filter((n): n is string => !!n && !existingCategoryMap.has(n.trim().toLowerCase()))
        )
      )
    : [];

  const totalProducts = result ? result.groups.reduce((s, g) => s + g.rows.length, 0) : 0;
  const variantGroupCount = result ? result.groups.filter((g) => g.isVariantGroup).length : 0;
  const simpleProductCount = result ? result.groups.filter((g) => !g.isVariantGroup).length : 0;

  async function handleImport() {
    if (!result) return;
    setImporting(true);
    const categoryMap = new Map(existingCategoryMap);
    try {
      if (newCategoryNames.length > 0) {
        const { data, error } = await supabase
          .from("categories")
          .insert(newCategoryNames.map((name) => ({ name })))
          .select();
        if (error) throw error;
        for (const c of data ?? []) categoryMap.set((c.name as string).trim().toLowerCase(), c.id as string);
      }
    } catch {
      toast.error("Unable to create the new categories. Import stopped before any products were added.");
      setImporting(false);
      return;
    }

    const initialResults: GroupResult[] = result.groups.map((g) => ({ name: g.name, status: "pending", created: 0 }));
    setGroupResults(initialResults);

    for (let i = 0; i < result.groups.length; i++) {
      const g = result.groups[i];
      const categoryId = g.categoryName ? categoryMap.get(g.categoryName.trim().toLowerCase()) ?? null : null;

      try {
        let newProductIds: string[] = [];

        if (!g.isVariantGroup) {
          const row = g.rows[0];
          const { data, error } = await supabase
            .from("products")
            .insert({
              name: g.name,
              sku: row.sku || null,
              barcode: row.barcode || null,
              category_id: categoryId,
              description: g.description,
              selling_price: row.sellingPrice,
              cost_price: row.costPrice,
              current_stock: row.stock,
              minimum_stock: 0,
              unit: g.baseUnit,
              image_url: row.imageUrl || null,
              active: true,
              track_inventory: g.trackInventory,
              tax_enabled: g.taxEnabled,
              tax_rate: g.taxRate,
            })
            .select("id")
            .single();
          if (error) throw error;
          newProductIds = [data.id as string];
          initialResults[i] = { name: g.name, status: "ok", created: 1 };
        } else {
          const { data: groupData, error: groupError } = await supabase
            .from("product_variant_groups")
            .insert({ name: g.name, category_id: categoryId, image_url: g.rows[0]?.imageUrl || null })
            .select()
            .single();
          if (groupError) throw groupError;

          const payload = g.rows.map((row) => ({
            name: `${g.name} - ${variantLabel(row)}`,
            sku: row.sku || null,
            barcode: row.barcode || null,
            category_id: categoryId,
            description: g.description,
            selling_price: row.sellingPrice,
            cost_price: row.costPrice,
            current_stock: row.stock,
            minimum_stock: 0,
            unit: g.baseUnit,
            image_url: row.imageUrl || null,
            active: true,
            track_inventory: g.trackInventory,
            tax_enabled: g.taxEnabled,
            tax_rate: g.taxRate,
            variant_group_id: groupData.id,
            variant_name: variantLabel(row) || "Variant",
          }));
          const { data: itemsData, error: itemsError } = await supabase.from("products").insert(payload).select("id");
          if (itemsError) throw itemsError;
          newProductIds = (itemsData ?? []).map((p) => p.id as string);
          initialResults[i] = { name: g.name, status: "ok", created: payload.length };
        }

        if (g.otherUnits.length > 0 && newProductIds.length > 0) {
          const unitsPayload = newProductIds.flatMap((productId) =>
            g.otherUnits.map((u) => ({
              product_id: productId,
              name: u.name,
              scale: u.scale,
              is_default: u.isDefault,
            }))
          );
          const { error: unitsError } = await supabase.from("product_units").insert(unitsPayload);
          if (unitsError) {
            initialResults[i].detail = "Products were created, but their extra units (Other Units) couldn't be saved.";
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        initialResults[i] = {
          name: g.name,
          status: "error",
          created: 0,
          detail: message.includes("duplicate key")
            ? "A SKU or barcode in this product already exists."
            : message,
        };
      }
      setGroupResults([...initialResults]);
    }

    setImporting(false);
    const okCount = initialResults.filter((r) => r.status === "ok").reduce((s, r) => s + r.created, 0);
    const errCount = initialResults.filter((r) => r.status === "error").length;
    if (okCount > 0) toast.success(`Imported ${okCount} product${okCount === 1 ? "" : "s"}.`);
    if (errCount > 0) toast.error(`${errCount} product group${errCount === 1 ? "" : "s"} failed — see details below.`);
    await onImported();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import products from CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!groupResults && (
            <>
              <div className="rounded-lg border border-dashed p-4 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                <FileUp className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Upload an Ewity "Import Variant Products" export — CSV or Excel (.xlsx), either the
                  filled-in template or a straight download — products with Size/Color-style variants,
                  each with its own price and stock.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={parsing}
                >
                  {parsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {fileName ?? "Choose file"}
                </Button>
              </div>

              {result && (
                <div className="space-y-3">
                  {result.errors.length > 0 && (
                    <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                        <XCircle className="h-4 w-4" />
                        This file has problems
                      </p>
                      {result.errors.slice(0, 8).map((e, i) => (
                        <p key={i} className="text-xs text-destructive">
                          {e}
                        </p>
                      ))}
                      {result.errors.length > 8 && (
                        <p className="text-xs text-destructive">+ {result.errors.length - 8} more</p>
                      )}
                    </div>
                  )}

                  {result.groups.length > 0 && (
                    <>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-lg border p-3 text-center">
                          <p className="text-lg font-semibold">{result.groups.length}</p>
                          <p className="text-xs text-muted-foreground">Products</p>
                        </div>
                        <div className="rounded-lg border p-3 text-center">
                          <p className="text-lg font-semibold">{variantGroupCount}</p>
                          <p className="text-xs text-muted-foreground">With variants</p>
                        </div>
                        <div className="rounded-lg border p-3 text-center">
                          <p className="text-lg font-semibold">{totalProducts}</p>
                          <p className="text-xs text-muted-foreground">Total SKUs</p>
                        </div>
                        <div className="rounded-lg border p-3 text-center">
                          <p className="text-lg font-semibold">{newCategoryNames.length}</p>
                          <p className="text-xs text-muted-foreground">New categories</p>
                        </div>
                      </div>

                      {newCategoryNames.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {newCategoryNames.map((n) => (
                            <Badge key={n} variant="outline">
                              + {n}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {result.warnings.length > 0 && (
                        <div className="space-y-1 rounded-lg border border-warning/40 bg-warning/5 p-3">
                          <p className="flex items-center gap-1.5 text-sm font-medium">
                            <AlertTriangle className="h-4 w-4" />
                            Heads up
                          </p>
                          {result.warnings.map((w, i) => (
                            <p key={i} className="text-xs text-muted-foreground">
                              {w}
                            </p>
                          ))}
                        </div>
                      )}

                      <div className="max-h-64 overflow-y-auto rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Product</TableHead>
                              <TableHead>Variants</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead className="text-right">Price range</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {result.groups.map((g, i) => {
                              const prices = g.rows.map((r) => r.sellingPrice);
                              const min = Math.min(...prices);
                              const max = Math.max(...prices);
                              return (
                                <TableRow key={i}>
                                  <TableCell className="font-medium">{g.name}</TableCell>
                                  <TableCell>{g.isVariantGroup ? `${g.rows.length} variants` : "—"}</TableCell>
                                  <TableCell className="text-muted-foreground">{g.categoryName ?? "—"}</TableCell>
                                  <TableCell className="text-right">
                                    {min === max ? formatMVR(min) : `${formatMVR(min)} – ${formatMVR(max)}`}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {groupResults && (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {groupResults.map((r, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  {r.status === "pending" && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
                  {r.status === "ok" && <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />}
                  {r.status === "error" && <XCircle className="h-4 w-4 shrink-0 text-destructive" />}
                  <span className="flex-1 truncate">{r.name}</span>
                  {r.status === "ok" && (
                    <span className="text-xs text-muted-foreground">{r.created} added</span>
                  )}
                  {r.status === "error" && <span className="text-xs text-destructive">{r.detail}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={importing}>
            {groupResults ? "Close" : "Cancel"}
          </Button>
          {!groupResults && (
            <Button
              onClick={handleImport}
              disabled={!result || result.groups.length === 0 || result.errors.length > 0 || importing}
            >
              {importing && <Loader2 className="h-4 w-4 animate-spin" />}
              Import {totalProducts > 0 ? `${totalProducts} product${totalProducts === 1 ? "" : "s"}` : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
