"use client";

import type { Product } from "@/types/database";
import { ProductCard } from "./product-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PackageSearch } from "lucide-react";

export function ProductGrid({ products, onSelect }: { products: Product[]; onSelect: (product: Product) => void }) {
  if (!products.length) {
    return <EmptyState icon={PackageSearch} title="No products found" description="Try a different search or category." className="border-none" />;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} onSelect={onSelect} />
      ))}
    </div>
  );
}
