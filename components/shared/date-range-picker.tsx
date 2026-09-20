"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayRange, thisWeekRange, thisMonthRange } from "@/lib/date-range";
import { useState } from "react";

/**
 * Shared date-range filter for Reports / Staff pages. Controls range via URL
 * search params (?from=&to=) so filtered views are shareable and persist on refresh.
 */
export function DateRangePicker({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);

  function applyRange(newFrom: string, newTo: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", newFrom);
    params.set("to", newTo);
    router.push(`${pathname}?${params.toString()}`);
  }

  function setPreset(range: { from: string; to: string }) {
    setLocalFrom(range.from);
    setLocalTo(range.to);
    applyRange(range.from, range.to);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="report-from">From</Label>
        <Input id="report-from" type="date" value={localFrom} onChange={(e) => setLocalFrom(e.target.value)} className="w-40" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="report-to">To</Label>
        <Input id="report-to" type="date" value={localTo} onChange={(e) => setLocalTo(e.target.value)} className="w-40" />
      </div>
      <Button variant="outline" onClick={() => applyRange(localFrom, localTo)}>
        Apply
      </Button>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={() => setPreset(todayRange())}>
          Today
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setPreset(thisWeekRange())}>
          This Week
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setPreset(thisMonthRange())}>
          This Month
        </Button>
      </div>
    </div>
  );
}
