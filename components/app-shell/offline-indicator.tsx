"use client";

import { useOnlineStatus } from "@/hooks/use-online-status";
import { WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function OfflineIndicator() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <Badge variant="destructive" className="gap-1">
      <WifiOff className="h-3 w-3" />
      Offline — sales will sync when reconnected
    </Badge>
  );
}
