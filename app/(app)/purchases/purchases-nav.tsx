"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function PurchasesNav() {
  const pathname = usePathname();
  const isSuppliers = pathname.startsWith("/suppliers");

  return (
    <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
      <Link
        href="/purchases"
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all",
          !isSuppliers && "bg-background text-foreground shadow-sm"
        )}
      >
        Purchases
      </Link>
      <Link
        href="/suppliers"
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all",
          isSuppliers && "bg-background text-foreground shadow-sm"
        )}
      >
        Suppliers
      </Link>
    </div>
  );
}
