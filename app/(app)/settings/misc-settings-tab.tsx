"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Printer } from "lucide-react";

const RECEIPT_WIDTH_KEY = "arh-pos:receipt-width";
const WARN_NEGATIVE_STOCK_KEY = "arh-pos:warn-negative-stock";

/**
 * These preferences have no dedicated columns in the schema, so they're kept
 * as per-device localStorage preferences rather than extending the (shared,
 * already-applied) SQL migration.
 */
export function MiscSettingsTab() {
  const [receiptWidth, setReceiptWidth] = useState<"58" | "80">("80");
  const [warnNegativeStock, setWarnNegativeStock] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const storedWidth = localStorage.getItem(RECEIPT_WIDTH_KEY);
      if (storedWidth === "58" || storedWidth === "80") setReceiptWidth(storedWidth);
      setWarnNegativeStock(localStorage.getItem(WARN_NEGATIVE_STOCK_KEY) === "true");
    } catch {
      // localStorage unavailable (private browsing etc) — fall back to defaults.
    } finally {
      setReady(true);
    }
  }, []);

  function updateReceiptWidth(width: "58" | "80") {
    setReceiptWidth(width);
    try {
      localStorage.setItem(RECEIPT_WIDTH_KEY, width);
    } catch {
      // ignore
    }
  }

  function updateWarnNegativeStock(value: boolean) {
    setWarnNegativeStock(value);
    try {
      localStorage.setItem(WARN_NEGATIVE_STOCK_KEY, String(value));
    } catch {
      // ignore
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Printer
          </CardTitle>
          <CardDescription>
            Uses the browser&apos;s print dialog — no special printer driver configuration is needed for thermal printers
            that register as a system printer.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Receipt width</CardTitle>
          <CardDescription>Saved on this device only.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {(["58", "80"] as const).map((width) => (
              <label key={width} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="receipt-width"
                  disabled={!ready}
                  checked={receiptWidth === width}
                  onChange={() => updateReceiptWidth(width)}
                />
                {width}mm
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
          <CardDescription>Saved on this device only.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm font-medium">Warn on negative stock</Label>
              <p className="text-xs text-muted-foreground">Show a warning when a sale would take stock below zero.</p>
            </div>
            <Switch checked={warnNegativeStock} disabled={!ready} onCheckedChange={updateWarnNegativeStock} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
