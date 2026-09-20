"use client";

import Image from "next/image";
import { cn, formatMVR } from "@/lib/utils";
import type { Product } from "@/types/database";
import { Package } from "lucide-react";

export function ProductCard({ product, onSelect }: { product: Product; onSelect: (product: Product) => void }) {
  const outOfStock = product.track_inventory && product.current_stock <= 0;

  return (
    <button
      type="button"
      disabled={outOfStock}
      onClick={() => onSelect(product)}
      className={cn(
        "pos-tap flex h-full flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-transform active:scale-[0.98]",
        outOfStock ? "cursor-not-allowed opacity-50" : "hover:border-primary/50 hover:shadow-md"
      )}
    >
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-muted">
        {product.image_url ? (
          <Image src={product.image_url} alt={product.name} fill sizes="200px" className="object-cover" unoptimized />
        ) : (
          <Package className="h-8 w-8 text-muted-foreground" />
        )}
        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground">Out of stock</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-between gap-1 p-2.5">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{product.name}</p>
        <p className="text-base font-semibold text-primary">{formatMVR(product.selling_price)}</p>
      </div>
    </button>
  );
}
