import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Customer, CustomerCreditBalance, PaymentMethod } from "@/types/database";
import { CustomersClient } from "./customers-client";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  const [{ data: customers }, { data: balances }, { data: paymentMethods }] = await Promise.all([
    supabase.from("customers").select("*").order("created_at", { ascending: false }),
    supabase.from("customer_credit_balances").select("*"),
    supabase.from("payment_methods").select("*").eq("enabled", true).order("display_order"),
  ]);

  const canManage = profile.role === "administrator" || profile.role === "manager";

  return (
    <CustomersClient
      initialCustomers={(customers ?? []) as Customer[]}
      initialBalances={(balances ?? []) as CustomerCreditBalance[]}
      paymentMethods={(paymentMethods ?? []) as PaymentMethod[]}
      canManage={canManage}
    />
  );
}
