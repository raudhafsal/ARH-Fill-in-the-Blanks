import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { RegisterClient } from "./register-client";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  const { data: openRegister } = await supabase
    .from("cash_registers")
    .select("*")
    .eq("cashier_id", profile.id)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let transactions: { id: string; type: string; amount: number; reason: string | null; notes: string | null; created_at: string }[] = [];
  if (openRegister) {
    const { data } = await supabase
      .from("cash_register_transactions")
      .select("*")
      .eq("register_id", openRegister.id)
      .order("created_at", { ascending: false });
    transactions = data ?? [];
  }

  return <RegisterClient profile={profile} openRegister={openRegister} transactions={transactions} />;
}
