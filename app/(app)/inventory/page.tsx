import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Product, ProductUnit } from "@/types/database";
import { InventoryClient } from "./inventory-client";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  await requireRole(["administrator", "manager"]);
  const supabase = createClient();

  const [{ data: products }, { data: productUnits }] = await Promise.all([
    supabase.from("products").select("*").eq("track_inventory", true).order("name", { ascending: true }),
    supabase.from("product_units").select("*"),
  ]);

  return (
    <InventoryClient
      initialProducts={(products ?? []) as Product[]}
      initialProductUnits={(productUnits ?? []) as ProductUnit[]}
    />
  );
}
