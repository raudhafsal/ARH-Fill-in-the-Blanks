"use client";

import type { SellableItem } from "@/lib/pos/types";
import { ProductCard } from "./product-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PackageSearch } from "lucide-react";

export function ProductGrid({ items, onSelect }: { items: SellableItem[]; onSelect: (item: SellableItem) => void }) {
  if (!items.length) {
    return <EmptyState icon={PackageSearch} title="No products found" description="Try a different search or category." className="border-none" />;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => (
        <ProductCard key={item.key} item={item} onSelect={onSelect} />
      ))}
    </div>
  );
}
