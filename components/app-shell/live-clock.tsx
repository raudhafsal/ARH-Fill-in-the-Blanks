"use client";

import { useEffect, useState } from "react";
import { formatMaldivesDateTime } from "@/lib/utils";

export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);

  if (!now) return null;

  return (
    <span className="hidden text-sm text-muted-foreground sm:inline">
      {formatMaldivesDateTime(now)} (MV time)
    </span>
  );
}
