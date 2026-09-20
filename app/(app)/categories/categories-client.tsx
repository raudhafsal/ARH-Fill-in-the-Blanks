"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/types/database";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ImageUpload } from "@/components/shared/image-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Tags, Loader2 } from "lucide-react";
import { toast } from "sonner";

const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(500).optional(),
  image_url: z.string().nullable().optional(),
  active: z.boolean(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

const emptyForm: CategoryFormValues = { name: "", description: "", image_url: null, active: true };

export function CategoriesClient({ initialCategories }: { initialCategories: Category[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryFormValues>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof CategoryFormValues, string>>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setDialogOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setForm({
      name: category.name,
      description: category.description ?? "",
      image_url: category.image_url,
      active: category.active,
    });
    setErrors({});
    setDialogOpen(true);
  }

  async function refresh() {
    const { data } = await supabase.from("categories").select("*").order("display_order", { ascending: true });
    setCategories((data ?? []) as Category[]);
  }

  async function handleSubmit() {
    const result = categorySchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof CategoryFormValues, string>> = {};
      for (const issue of result.error.issues) {
        fieldErrors[issue.path[0] as keyof CategoryFormValues] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("categories")
          .update({
            name: result.data.name,
            description: result.data.description || null,
            image_url: result.data.image_url || null,
            active: result.data.active,
          })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Category updated.");
      } else {
        const nextOrder = categories.length ? Math.max(...categories.map((c) => c.display_order)) + 1 : 0;
        const { error } = await supabase.from("categories").insert({
          name: result.data.name,
          description: result.data.description || null,
          image_url: result.data.image_url || null,
          active: result.data.active,
          display_order: nextOrder,
        });
        if (error) throw error;
        toast.success("Category created.");
      }
      setDialogOpen(false);
      await refresh();
    } catch {
      toast.error("Unable to save category. Please check the details and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from("categories").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success("Category deleted.");
      await refresh();
    } catch {
      toast.error("Unable to delete category. It may be in use by products.");
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleMove(category: Category, direction: "up" | "down") {
    const sorted = [...categories].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex((c) => c.id === category.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const neighbor = sorted[swapIdx];

    setReorderingId(category.id);
    try {
      const [{ error: e1 }, { error: e2 }] = await Promise.all([
        supabase.from("categories").update({ display_order: neighbor.display_order }).eq("id", category.id),
        supabase.from("categories").update({ display_order: category.display_order }).eq("id", neighbor.id),
      ]);
      if (e1 || e2) throw e1 || e2;
      await refresh();
    } catch {
      toast.error("Unable to reorder categories.");
    } finally {
      setReorderingId(null);
    }
  }

  const sorted = [...categories].sort((a, b) => a.display_order - b.display_order);

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Organize products into categories for the POS and menu."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New category
          </Button>
        }
      />

      <div className="p-4 sm:p-6">
        {sorted.length === 0 ? (
          <EmptyState
            icon={Tags}
            title="No categories yet"
            description="Create your first category to start organizing products."
            action={
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                New category
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((category, idx) => (
              <Card key={category.id} className="overflow-hidden">
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-muted">
                    {category.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={category.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Tags className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{category.name}</p>
                      {!category.active && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    {category.description && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{category.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={idx === 0 || reorderingId === category.id}
                        onClick={() => handleMove(category, "up")}
                        aria-label="Move up"
                      >
                        {reorderingId === category.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={idx === sorted.length - 1 || reorderingId === category.id}
                        onClick={() => handleMove(category, "down")}
                        aria-label="Move down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <div className="ml-auto flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(category)} aria-label="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(category)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-image">Image</Label>
              <ImageUpload bucket="product-images" value={form.image_url} onChange={(url) => setForm((f) => ({ ...f, image_url: url }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Beverages"
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea
                id="cat-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Inactive categories are hidden from the POS.</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete category?"
        description={`This will permanently delete "${deleteTarget?.name}". Products in this category will keep their data but lose the category link if it's referenced.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}
