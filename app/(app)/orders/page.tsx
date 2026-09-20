import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { OrdersClient } from "./orders-client";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  const isManager = profile.role !== "cashier";

  const [{ data: paymentMethods }, { data: cashiers }] = await Promise.all([
    supabase.from("payment_methods").select("*").order("display_order"),
    isManager ? supabase.from("profiles").select("id, full_name").order("full_name") : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  return <OrdersClient profile={profile} paymentMethods={paymentMethods ?? []} cashiers={cashiers ?? []} isManager={isManager} />;
}
