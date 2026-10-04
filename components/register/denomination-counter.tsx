"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMVR } from "@/lib/utils";
import { DENOMINATIONS, denominationsTotal, type Denominations } from "@/lib/register";
import { Calculator, ChevronDown, ChevronUp } from "lucide-react";

/**
 * Ewity-style "Cash Register Amount Calculator": type how many of each note/coin is in the drawer
 * and it adds them up. Collapsed by default so a cashier who just types a total isn't slowed down.
 * Calls onChange with the counts and their total every time a count changes.
 */
export function DenominationCounter({
  value,
  onChange,
  defaultOpen = false,
}: {
  value: Denominations;
  onChange: (next: Denominations, total: number) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const total = denominationsTotal(value);

  function setCount(denom: number, raw: string) {
    const n = Math.max(0, Math.floor(Number(raw) || 0));
    const next = { ...value, [String(denom)]: n };
    onChange(next, denominationsTotal(next));
  }

  return (
    <div className="rounded-lg border">
      <Button
        type="button"
        variant="ghost"
        className="flex h-auto w-full items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Count notes &amp; coins
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          {total > 0 && <span className="font-semibold text-foreground">{formatMVR(total)}</span>}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </Button>
      {open && (
        <div className="space-y-1.5 border-t p-3">
          <div className="grid grid-cols-[1fr_5rem_6rem] items-center gap-2 text-xs font-medium text-muted-foreground">
            <span>Denomination</span>
            <span className="text-center">Count</span>
            <span className="text-right">Total</span>
          </div>
          {DENOMINATIONS.map((d) => {
            const count = value[String(d)] ?? 0;
            return (
              <div key={d} className="grid grid-cols-[1fr_5rem_6rem] items-center gap-2">
                <span className="text-sm">Rf {d}</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  className="h-9 text-center"
                  value={count === 0 ? "" : count}
                  placeholder="0"
                  onChange={(e) => setCount(d, e.target.value)}
                  aria-label={`Number of Rf ${d}`}
                />
                <span className="text-right text-sm tabular-nums">{(d * count).toFixed(2)}</span>
              </div>
            );
          })}
          <div className="flex justify-between border-t pt-2 text-sm font-semibold">
            <span>Sub total</span>
            <span className="tabular-nums">{total.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
