import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { round2 } from "@/lib/utils";
import { StatementClient, type StatementLine } from "./statement-client";

export const dynamic = "force-dynamic";

export default async function CustomerStatementPage({ params }: { params: { id: string } }) {
  await requireProfile();
  const supabase = createClient();

  const [{ data: customer }, { data: business }, { data: orders }, { data: settlements }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("business_settings").select("*").maybeSingle(),
    supabase
      .from("orders")
      .select("id, order_number, created_at, total, order_items(product_name, quantity), payments(amount, payment_method:payment_methods(code)), refunds(refund_amount, created_at, reason)")
      .eq("customer_id", params.id)
      .eq("voided", false)
      .order("created_at", { ascending: true }),
    supabase.from("credit_settlements").select("id, amount, reference, created_at, payment_method:payment_methods(name)").eq("customer_id", params.id).order("created_at", { ascending: true }),
  ]);
  if (!customer || !business) notFound();

  const lines: Omit<StatementLine, "balance">[] = [];
  for (const o of (orders ?? []) as any[]) {
    const isCredit = (o.payments ?? []).some((p: any) => String(p.payment_method?.code ?? "").startsWith("credit"));
    if (!isCredit) continue;
    const items = (o.order_items ?? []).map((i: any) => `${Number(i.quantity)} × ${i.product_name}`).join(", ");
    lines.push({ date: o.created_at, ref: o.order_number, description: items || "Credit sale", charge: Number(o.total), credit: 0 });
    for (const r of o.refunds ?? []) {
      lines.push({ date: r.created_at, ref: o.order_number, description: `Refund${r.reason ? ` — ${r.reason}` : ""}`, charge: 0, credit: Number(r.refund_amount) });
    }
  }
  for (const s of (settlements ?? []) as any[]) {
    lines.push({
      date: s.created_at,
      ref: s.reference || "Payment",
      description: `Payment received${s.payment_method?.name ? ` (${s.payment_method.name})` : ""}`,
      charge: 0,
      credit: Number(s.amount),
    });
  }
  lines.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let running = 0;
  const ledger: StatementLine[] = lines.map((l) => {
    running = round2(running + l.charge - l.credit);
    return { ...l, balance: running };
  });

  return <StatementClient customer={customer} business={business} lines={ledger} generatedAt={new Date().toISOString()} />;
}
