"use client";

import { cn } from "@/lib/utils";
import type { Category } from "@/types/database";

export function CategoryTabs({
  categories,
  activeId,
  onSelect,
}: {
  categories: Category[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "pos-tap shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors",
          activeId === null ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
        )}
      >
        All
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c.id)}
          className={cn(
            "pos-tap shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors",
            activeId === c.id ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
          )}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
