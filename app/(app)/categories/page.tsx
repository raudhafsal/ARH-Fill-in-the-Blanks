import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/types/database";
import { CategoriesClient } from "./categories-client";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  await requireRole(["administrator", "manager"]);
  const supabase = createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("display_order", { ascending: true });

  return <CategoriesClient initialCategories={(categories ?? []) as Category[]} />;
}
