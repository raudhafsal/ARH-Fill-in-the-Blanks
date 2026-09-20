import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { PosClient } from "./pos-client";

export const dynamic = "force-dynamic";

export default async function PosPage() {
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

  // A cashier must open a register with an opening float before selling.
  if (!openRegister) {
    redirect("/register");
  }

  const [{ data: categories }, { data: products }, { data: paymentMethods }, { data: taxSettings }, { data: businessSettings }, { data: discountLimit }] =
    await Promise.all([
      supabase.from("categories").select("*").eq("active", true).order("display_order"),
      supabase.from("products").select("*").eq("active", true).order("name"),
      supabase.from("payment_methods").select("*").eq("enabled", true).order("display_order"),
      supabase.from("tax_settings").select("*").maybeSingle(),
      supabase.from("business_settings").select("*").maybeSingle(),
      supabase.from("discount_limits").select("*").eq("role", profile.role).maybeSingle(),
    ]);

  return (
    <PosClient
      profile={profile}
      register={openRegister}
      categories={categories ?? []}
      products={products ?? []}
      paymentMethods={paymentMethods ?? []}
      taxSettings={taxSettings}
      businessSettings={businessSettings}
      discountLimit={discountLimit}
    />
  );
}
