import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { normalizeSummaryRows } from "@/lib/register";
import type { RegisterSummaryRow } from "@/types/database";
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
  let summary: RegisterSummaryRow[] = [];
  if (openRegister) {
    const [{ data: txns }, { data: rows }] = await Promise.all([
      supabase
        .from("cash_register_transactions")
        .select("*")
        .eq("register_id", openRegister.id)
        .order("created_at", { ascending: false }),
      supabase.rpc("register_session_summary", { p_register_id: openRegister.id }),
    ]);
    transactions = txns ?? [];
    summary = normalizeSummaryRows(rows);
  }

  return <RegisterClient profile={profile} openRegister={openRegister} transactions={transactions} summary={summary} />;
}
