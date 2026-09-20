"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BusinessSettings, OrderType } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUpload } from "@/components/shared/image-upload";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function BusinessSettingsTab({ isAdmin, initial }: { isAdmin: boolean; initial: BusinessSettings }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("business_settings")
        .update({
          business_name: form.business_name,
          logo_url: form.logo_url,
          address: form.address,
          phone: form.phone,
          email: form.email,
          receipt_footer: form.receipt_footer,
          currency: form.currency,
          default_order_type: form.default_order_type,
          dine_in_enabled: form.dine_in_enabled,
          kitchen_screen_enabled: form.kitchen_screen_enabled,
        })
        .eq("id", true);
      if (error) throw error;
      toast.success("Business settings saved.");
    } catch {
      toast.error("Unable to save business settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Business Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label>Logo</Label>
          <ImageUpload
            bucket="business-assets"
            value={form.logo_url}
            onChange={(url) => setForm({ ...form, logo_url: url })}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="business_name">Business name</Label>
            <Input
              id="business_name"
              value={form.business_name}
              disabled={!isAdmin}
              onChange={(e) => setForm({ ...form, business_name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="currency">Currency</Label>
            <Input id="currency" value={form.currency} disabled={!isAdmin} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={form.phone} disabled={!isAdmin} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={form.email} disabled={!isAdmin} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="address">Address</Label>
          <Textarea id="address" rows={2} value={form.address} disabled={!isAdmin} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="receipt_footer">Receipt footer</Label>
          <Textarea
            id="receipt_footer"
            rows={2}
            value={form.receipt_footer}
            disabled={!isAdmin}
            onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })}
          />
        </div>

        <div className="space-y-1 max-w-xs">
          <Label>Default order type</Label>
          <Select
            value={form.default_order_type}
            onValueChange={(v) => setForm({ ...form, default_order_type: v as OrderType })}
            disabled={!isAdmin}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="takeaway">Takeaway</SelectItem>
              <SelectItem value="pickup">Pickup</SelectItem>
              <SelectItem value="dine_in">Dine in</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Dine-in enabled</p>
            <p className="text-xs text-muted-foreground">Allow selecting dine-in as an order type in POS.</p>
          </div>
          <Switch checked={form.dine_in_enabled} disabled={!isAdmin} onCheckedChange={(v) => setForm({ ...form, dine_in_enabled: v })} />
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Kitchen screen enabled</p>
            <p className="text-xs text-muted-foreground">Turn on the /kitchen preparation screen.</p>
          </div>
          <Switch
            checked={form.kitchen_screen_enabled}
            disabled={!isAdmin}
            onCheckedChange={(v) => setForm({ ...form, kitchen_screen_enabled: v })}
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
