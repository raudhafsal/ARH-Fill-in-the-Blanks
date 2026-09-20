import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { ReceiptPageClient } from "./receipt-page-client";
import type { ReceiptData } from "@/lib/pos/types";

export const dynamic = "force-dynamic";

export default async function OrderReceiptPage({ params }: { params: { id: string } }) {
  await requireProfile();
  const supabase = createClient();

  const [{ data: order }, { data: businessSettings }, { data: taxSettings }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "*, cashier:profiles!orders_cashier_id_fkey(full_name), order_items(*), payments(*, payment_method:payment_methods(name))"
      )
      .eq("id", params.id)
      .maybeSingle(),
    supabase.from("business_settings").select("*").maybeSingle(),
    supabase.from("tax_settings").select("*").maybeSingle(),
  ]);

  if (!order || !businessSettings) notFound();

  const receiptData: ReceiptData = {
    orderNumber: order.order_number,
    createdAt: order.created_at,
    cashierName: (order as any).cashier?.full_name ?? "—",
    orderType: order.order_type,
    notes: order.notes,
    items: (order as any).order_items.map((i: any) => ({
      productName: i.product_name,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      itemDiscountAmount: i.item_discount_amount,
      lineTotal: i.line_total,
    })),
    subtotal: order.subtotal,
    discountAmount: order.discount_amount,
    taxAmount: order.tax_amount,
    taxName: taxSettings?.name ?? "Tax",
    total: order.total,
    payments: (order as any).payments.map((p: any) => ({
      methodName: p.payment_method?.name ?? "Payment",
      amount: p.amount,
      amountReceived: p.amount_received,
      changeAmount: p.change_amount,
    })),
    syncStatus: order.sync_status,
  };

  return <ReceiptPageClient data={receiptData} business={businessSettings} />;
}
