import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Supplier, Product } from "@/types/database";
import { PurchaseForm } from "../purchase-form";

export const dynamic = "force-dynamic";

export default async function NewPurchasePage() {
  await requireRole(["administrator", "manager"]);
  const supabase = createClient();

  const [{ data: suppliers }, { data: products }] = await Promise.all([
    supabase.from("suppliers").select("*").order("name", { ascending: true }),
    supabase.from("products").select("*").order("name", { ascending: true }),
  ]);

  return (
    <PurchaseForm
      mode="create"
      suppliers={(suppliers ?? []) as Supplier[]}
      products={(products ?? []) as Product[]}
    />
  );
}
