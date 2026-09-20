"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { listPending, onQueueChange, type QueuedSale } from "@/lib/pos/offline-queue";
import { CloudOff, CloudCog } from "lucide-react";

/** Shows a small badge whenever there are sales waiting to sync, or that failed to sync. */
export function SyncStatusBadge() {
  const [sales, setSales] = useState<QueuedSale[]>([]);

  useEffect(() => {
    setSales(listPending());
    return onQueueChange(() => setSales(listPending()));
  }, []);

  if (sales.length === 0) return null;

  const failed = sales.filter((s) => s.status === "failed").length;
  const pending = sales.length - failed;

  return (
    <div className="flex items-center gap-1.5">
      {pending > 0 && (
        <Badge variant="warning" className="gap-1">
          <CloudCog className="h-3 w-3" /> {pending} Pending Sync
        </Badge>
      )}
      {failed > 0 && (
        <Badge variant="destructive" className="gap-1">
          <CloudOff className="h-3 w-3" /> {failed} Sync Failed
        </Badge>
      )}
    </div>
  );
}
