import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Customer } from "@/types/database";
import { CustomersClient } from "./customers-client";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  const canManage = profile.role === "administrator" || profile.role === "manager";

  return <CustomersClient initialCustomers={(customers ?? []) as Customer[]} canManage={canManage} />;
}
