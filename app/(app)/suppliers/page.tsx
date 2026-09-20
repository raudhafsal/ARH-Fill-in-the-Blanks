import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Supplier } from "@/types/database";
import { SuppliersClient } from "./suppliers-client";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  await requireRole(["administrator", "manager"]);
  const supabase = createClient();

  const { data: suppliers } = await supabase.from("suppliers").select("*").order("name", { ascending: true });

  return <SuppliersClient initialSuppliers={(suppliers ?? []) as Supplier[]} />;
}
