"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/database";
import { LayoutGrid } from "lucide-react";

export const ALL_ITEMS_ID = "__all__";

const TILE_COLORS = [
  "bg-blue-600",
  "bg-teal-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-indigo-600",
  "bg-cyan-600",
  "bg-orange-600",
  "bg-violet-600",
  "bg-lime-600",
  "bg-pink-600",
  "bg-sky-600",
];

/** Deterministic color per category, so a category always gets the same tile color across renders/sessions. */
function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return TILE_COLORS[hash % TILE_COLORS.length];
}

/** The POS home screen: big category tiles to tap into, Ewity-style, instead of a flat product grid. */
export function CategoryTiles({ categories, onSelect }: { categories: Category[]; onSelect: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      <button
        type="button"
        onClick={() => onSelect(ALL_ITEMS_ID)}
        className="pos-tap flex aspect-[4/3] flex-col justify-between rounded-xl border-2 border-dashed p-4 text-left shadow-sm transition-transform hover:border-primary/50 active:scale-[0.98]"
      >
        <LayoutGrid className="h-8 w-8 text-muted-foreground" />
        <span className="text-sm font-semibold">All items</span>
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c.id)}
          className={cn(
            "pos-tap relative flex aspect-[4/3] flex-col justify-between overflow-hidden rounded-xl p-4 text-left text-white shadow-sm transition-transform active:scale-[0.98]",
            colorForId(c.id)
          )}
        >
          {c.image_url && (
            <Image src={c.image_url} alt="" fill sizes="200px" className="object-cover opacity-40" unoptimized />
          )}
          <span className="relative text-3xl font-bold leading-none">{c.name.charAt(0).toUpperCase()}</span>
          <span className="relative truncate text-sm font-semibold">{c.name}</span>
        </button>
      ))}
    </div>
  );
}
