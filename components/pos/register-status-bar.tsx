"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMaldivesTime } from "@/lib/utils";
import type { CashRegister } from "@/types/database";
import { Lock } from "lucide-react";

export function RegisterStatusBar({ register, cashierName }: { register: CashRegister; cashierName: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b bg-muted/50 px-3 py-1.5 text-xs">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Badge variant="success" className="text-[10px]">Register open</Badge>
        since {formatMaldivesTime(register.opened_at)} · {cashierName}
      </span>
      <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
        <Link href="/register">
          <Lock className="h-3 w-3" /> Manage register
        </Link>
      </Button>
    </div>
  );
}
