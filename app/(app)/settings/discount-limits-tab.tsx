"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DiscountLimit } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function DiscountLimitsTab({ isAdmin, initial }: { isAdmin: boolean; initial: DiscountLimit[] }) {
  const order: DiscountLimit["role"][] = ["cashier", "manager", "administrator"];
  const [limits, setLimits] = useState(
    order.map((role) => initial.find((l) => l.role === role) ?? { role, max_percent: 0, unlimited: false })
  );
  const [saving, setSaving] = useState<string | null>(null);

  async function save(role: DiscountLimit["role"], patch: Partial<DiscountLimit>) {
    setSaving(role);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("discount_limits").update(patch).eq("role", role);
      if (error) throw error;
      setLimits((prev) => prev.map((l) => (l.role === role ? { ...l, ...patch } : l)));
      toast.success("Discount limit updated.");
    } catch {
      toast.error("Unable to update discount limit.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Discount Limits</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {limits.map((limit) => {
          const editableMaxPercent = isAdmin && (limit.role === "cashier" || limit.role === "manager");
          const editableUnlimited = isAdmin && limit.role === "administrator";
          return (
            <div key={limit.role} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
              <p className="text-sm font-medium capitalize">{limit.role}</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`max_${limit.role}`} className="text-xs text-muted-foreground">
                    Max %
                  </Label>
                  <Input
                    id={`max_${limit.role}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-24"
                    value={limit.max_percent ?? 0}
                    disabled={!editableMaxPercent || limit.unlimited || saving === limit.role}
                    onChange={(e) =>
                      setLimits((prev) =>
                        prev.map((l) => (l.role === limit.role ? { ...l, max_percent: Number(e.target.value) } : l))
                      )
                    }
                    onBlur={(e) => editableMaxPercent && save(limit.role, { max_percent: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Unlimited</Label>
                  <Switch
                    checked={limit.unlimited}
                    disabled={!editableUnlimited || saving === limit.role}
                    onCheckedChange={(v) => save(limit.role, { unlimited: v })}
                  />
                  {saving === limit.role && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
