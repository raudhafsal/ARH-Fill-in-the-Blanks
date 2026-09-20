"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TaxSettings } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function TaxSettingsTab({ isAdmin, initial }: { isAdmin: boolean; initial: TaxSettings }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("tax_settings")
        .update({
          enabled: form.enabled,
          name: form.name,
          percentage: form.percentage,
          price_inclusive: form.price_inclusive,
        })
        .eq("id", true);
      if (error) throw error;
      toast.success("Tax settings saved.");
    } catch {
      toast.error("Unable to save tax settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Tax Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Tax enabled</p>
            <p className="text-xs text-muted-foreground">Apply tax to orders in POS.</p>
          </div>
          <Switch checked={form.enabled} disabled={!isAdmin} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="tax_name">Tax name</Label>
            <Input id="tax_name" value={form.name} disabled={!isAdmin} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tax_percentage">Percentage (%)</Label>
            <Input
              id="tax_percentage"
              type="number"
              step="0.01"
              min="0"
              value={form.percentage}
              disabled={!isAdmin}
              onChange={(e) => setForm({ ...form, percentage: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Price inclusive</p>
            <p className="text-xs text-muted-foreground">When on, listed prices already include tax.</p>
          </div>
          <Switch
            checked={form.price_inclusive}
            disabled={!isAdmin}
            onCheckedChange={(v) => setForm({ ...form, price_inclusive: v })}
          />
        </div>

        {isAdmin && (
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
