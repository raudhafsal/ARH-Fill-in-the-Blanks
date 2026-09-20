import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { OrderDetailClient } from "./order-detail-client";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const profile = await requireProfile();
  const supabase = createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "*, cashier:profiles!orders_cashier_id_fkey(full_name), customer:customers(full_name, phone), order_items(*), payments(*, payment_method:payment_methods(name, code))"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!order) notFound();

  const canManage = profile.role === "administrator" || profile.role === "manager";

  let refundItems: { order_item_id: string; quantity: number }[] = [];
  if (canManage) {
    const { data: refunds } = await supabase.from("refunds").select("id, refund_items(order_item_id, quantity)").eq("order_id", order.id);
    refundItems = (refunds ?? []).flatMap((r: any) => r.refund_items ?? []);
  }

  const { data: businessSettings } = await supabase.from("business_settings").select("*").maybeSingle();
  const { data: taxSettings } = await supabase.from("tax_settings").select("*").maybeSingle();

  return (
    <OrderDetailClient
      order={order as any}
      canManage={canManage}
      refundItems={refundItems}
      businessSettings={businessSettings}
      taxName={taxSettings?.name ?? "Tax"}
    />
  );
}
