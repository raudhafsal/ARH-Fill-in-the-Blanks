import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { BusinessSettings, DiscountLimit, PaymentMethod, Profile, TaxSettings } from "@/types/database";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await requireRole(["administrator", "manager"]);
  const supabase = createClient();

  const [
    { data: businessSettings },
    { data: taxSettings },
    { data: paymentMethods },
    { data: discountLimits },
    { data: profiles },
  ] = await Promise.all([
    supabase.from("business_settings").select("*").eq("id", true).single(),
    supabase.from("tax_settings").select("*").eq("id", true).single(),
    supabase.from("payment_methods").select("*").order("display_order", { ascending: true }),
    supabase.from("discount_limits").select("*"),
    supabase.from("profiles").select("*").order("full_name", { ascending: true }),
  ]);

  return (
    <SettingsClient
      isAdmin={profile.role === "administrator"}
      businessSettings={businessSettings as BusinessSettings}
      taxSettings={taxSettings as TaxSettings}
      paymentMethods={(paymentMethods ?? []) as PaymentMethod[]}
      discountLimits={(discountLimits ?? []) as DiscountLimit[]}
      profiles={(profiles ?? []) as Profile[]}
    />
  );
}
