"use client";

import { useState } from "react";
import { Receipt } from "@/components/pos/receipt";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { ReceiptData } from "@/lib/pos/types";
import type { BusinessSettings } from "@/types/database";
import { Printer } from "lucide-react";

export function ReceiptPageClient({ data, business }: { data: ReceiptData; business: BusinessSettings }) {
  const [width, setWidth] = useState<"58mm" | "80mm" | "a4">("a4");

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Receipt — {data.orderNumber}</h1>
        <div className="flex items-center gap-2">
          <Select value={width} onValueChange={(v) => setWidth(v as "58mm" | "80mm" | "a4")}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a4">A4 / Browser</SelectItem>
              <SelectItem value="80mm">80mm thermal</SelectItem>
              <SelectItem value="58mm">58mm thermal</SelectItem>
            </SelectContent>
          </Select>
          <Button className="gap-1.5" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card py-4">
        <Receipt data={data} business={business} width={width} />
      </div>
    </div>
  );
}
