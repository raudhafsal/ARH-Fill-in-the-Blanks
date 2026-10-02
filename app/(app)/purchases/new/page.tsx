import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Supplier, Product, ProductUnit } from "@/types/database";
import { PurchaseForm } from "../purchase-form";

export const dynamic = "force-dynamic";

export default async function NewPurchasePage() {
  await requireRole(["administrator", "manager"]);
  const supabase = createClient();

  const [{ data: suppliers }, { data: products }, { data: productUnits }] = await Promise.all([
    supabase.from("suppliers").select("*").order("name", { ascending: true }),
    supabase.from("products").select("*").order("name", { ascending: true }),
    supabase.from("product_units").select("*"),
  ]);

  return (
    <PurchaseForm
      mode="create"
      suppliers={(suppliers ?? []) as Supplier[]}
      products={(products ?? []) as Product[]}
      productUnits={(productUnits ?? []) as ProductUnit[]}
    />
  );
}
