import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PurchasesClient, type PurchaseRow } from "./purchases-client";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  await requireRole(["administrator", "manager"]);
  const supabase = createClient();

  const { data: purchases } = await supabase
    .from("purchases")
    .select("*, supplier:suppliers(name)")
    .order("created_at", { ascending: false });

  return <PurchasesClient initialPurchases={(purchases ?? []) as PurchaseRow[]} />;
}
