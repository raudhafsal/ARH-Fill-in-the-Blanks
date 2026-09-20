import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { BusinessSettings, Order, OrderItem } from "@/types/database";
import { KitchenClient } from "./kitchen-client";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ChefHat } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export type KitchenOrder = Order & { order_items: OrderItem[] };

export default async function KitchenPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  const { data: settings } = await supabase.from("business_settings").select("*").eq("id", true).single();
  const businessSettings = settings as BusinessSettings | null;

  if (!businessSettings?.kitchen_screen_enabled) {
    return (
      <div>
        <PageHeader title="Kitchen" description="Preparation screen" />
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={ChefHat}
            title="Kitchen screen is disabled in Settings"
            description="An administrator can turn this on from Settings → Business."
            action={
              profile.role === "administrator" ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/settings">Go to Settings</Link>
                </Button>
              ) : undefined
            }
          />
        </div>
      </div>
    );
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .in("status", ["new", "preparing", "ready"])
    .eq("voided", false)
    .order("created_at", { ascending: true });

  return <KitchenClient initialOrders={(orders ?? []) as KitchenOrder[]} canUpdate={profile.role !== "cashier"} />;
}
