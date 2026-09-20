"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PaymentMethod } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ArrowUp, ArrowDown, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function PaymentMethodsTab({ isAdmin, initial }: { isAdmin: boolean; initial: PaymentMethod[] }) {
  const [methods, setMethods] = useState(
    [...initial].sort((a, b) => a.display_order - b.display_order)
  );
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  async function toggleEnabled(method: PaymentMethod) {
    const supabase = createClient();
    const { error } = await supabase.from("payment_methods").update({ enabled: !method.enabled }).eq("id", method.id);
    if (error) {
      toast.error("Unable to update payment method.");
      return;
    }
    setMethods((prev) => prev.map((m) => (m.id === method.id ? { ...m, enabled: !m.enabled } : m)));
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= methods.length) return;
    const a = methods[index];
    const b = methods[target];
    const supabase = createClient();
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("payment_methods").update({ display_order: b.display_order }).eq("id", a.id),
      supabase.from("payment_methods").update({ display_order: a.display_order }).eq("id", b.id),
    ]);
    if (e1 || e2) {
      toast.error("Unable to reorder payment methods.");
      return;
    }
    const next = [...methods];
    next[index] = { ...a, display_order: b.display_order };
    next[target] = { ...b, display_order: a.display_order };
    next.sort((x, y) => x.display_order - y.display_order);
    setMethods(next);
  }

  async function addMethod() {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const supabase = createClient();
      const code = `${slugify(newName)}_${Date.now().toString(36)}`;
      const maxOrder = methods.reduce((m, x) => Math.max(m, x.display_order), 0);
      const { data, error } = await supabase
        .from("payment_methods")
        .insert({ name: newName.trim(), code, display_order: maxOrder + 1, enabled: true })
        .select()
        .single();
      if (error) throw error;
      setMethods((prev) => [...prev, data as PaymentMethod]);
      setNewName("");
      toast.success("Payment method added.");
    } catch {
      toast.error("Unable to add payment method.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Payment Methods</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="divide-y rounded-md border">
          {methods.map((method, index) => (
            <div key={method.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{method.name}</p>
                <p className="text-xs text-muted-foreground">{method.code}</p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <>
                    <Button variant="ghost" size="icon" disabled={index === 0} onClick={() => move(index, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" disabled={index === methods.length - 1} onClick={() => move(index, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <Switch checked={method.enabled} disabled={!isAdmin} onCheckedChange={() => toggleEnabled(method)} />
              </div>
            </div>
          ))}
        </div>

        {isAdmin && (
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="new_method">Add a payment method</Label>
              <Input id="new_method" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Loyalty Points" />
            </div>
            <Button onClick={addMethod} disabled={adding || !newName.trim()}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
