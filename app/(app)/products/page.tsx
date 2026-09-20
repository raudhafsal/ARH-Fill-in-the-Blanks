import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Product, Category } from "@/types/database";
import { ProductsClient } from "./products-client";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  await requireRole(["administrator", "manager"]);
  const supabase = createClient();

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*").order("name", { ascending: true }),
    supabase.from("categories").select("*").order("display_order", { ascending: true }),
  ]);

  return (
    <ProductsClient
      initialProducts={(products ?? []) as Product[]}
      categories={(categories ?? []) as Category[]}
    />
  );
}
