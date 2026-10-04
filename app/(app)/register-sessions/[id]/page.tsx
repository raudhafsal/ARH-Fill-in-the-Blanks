import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeSummaryRows } from "@/lib/register";
import type { CashRegister, CashRegisterCloseLine, CashRegisterTransaction } from "@/types/database";
import type { ReconRow } from "@/components/register/reconciliation-table";
import { SessionDetailClient, type SessionPayment } from "./session-detail-client";

export const dynamic = "force-dynamic";

export default async function RegisterSessionDetailPage({ params }: { params: { id: string } }) {
  await requireRole(["administrator", "manager"]);
  const supabase = createClient();

  const { data } = await supabase.from("cash_registers").select("*").eq("id", params.id).maybeSingle();
  if (!data) notFound();
  const session = data as CashRegister;

  const [{ data: txns }, { data: orders }, { data: summaryData }, { data: lines }, { data: methods }] = await Promise.all([
    supabase.from("cash_register_transactions").select("*").eq("register_id", session.id).in("type", ["cash_in", "cash_out"]).order("created_at"),
    supabase.from("orders").select("id, order_number").eq("register_id", session.id).eq("voided", false),
    supabase.rpc("register_session_summary", { p_register_id: session.id }),
    supabase.from("cash_register_close_lines").select("*").eq("register_id", session.id),
    supabase.from("payment_methods").select("id, name, code, display_order").order("display_order"),
  ]);

  const orderMap = new Map((orders ?? []).map((o) => [o.id, o.order_number as string]));
  let payments: SessionPayment[] = [];
  if (orderMap.size > 0) {
    const { data: pays } = await supabase
      .from("payments")
      .select("id, order_id, payment_method_id, amount, created_at")
      .in("order_id", Array.from(orderMap.keys()))
      .order("created_at");
    const methodName = new Map((methods ?? []).map((m) => [m.id, m.name as string]));
    payments = (pays ?? []).map((p) => ({
      id: p.id,
      orderId: p.order_id,
      orderNumber: orderMap.get(p.order_id) ?? "—",
      methodId: p.payment_method_id,
      method: methodName.get(p.payment_method_id) ?? "—",
      amount: Number(p.amount),
      createdAt: p.created_at,
    }));
  }

  const ids = [session.cashier_id, session.closed_by].filter(Boolean) as string[];
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name as string]));

  const summary = normalizeSummaryRows(summaryData);
  const closeLines = (lines ?? []) as CashRegisterCloseLine[];
  let rows: ReconRow[];
  if (session.status === "closed") {
    const lineMap = new Map(closeLines.map((l) => [l.payment_method_id, l]));
    if (closeLines.length > 0) {
      rows = closeLines
        .map((l) => {
          const m = (methods ?? []).find((x) => x.id === l.payment_method_id);
          return { order: m?.display_order ?? 99, row: { id: l.payment_method_id, name: m?.name ?? "—", isCash: m?.code === "cash", isCredit: false, opening: Number(l.opening), received: Number(l.received), expected: Number(l.expected), counted: Number(l.counted), difference: Number(l.difference) } as ReconRow };
        })
        .sort((a, b) => a.order - b.order)
        .map((x) => x.row);
      // credit methods are not stored as lines — show them in the footnote from live figures
      rows.push(...summary.filter((r) => r.is_credit && !lineMap.has(r.payment_method_id)).map((r) => ({ id: r.payment_method_id, name: r.method_name, isCash: false, isCredit: true, opening: 0, received: r.received, expected: 0 })));
    } else {
      // Closed before register sessions existed: only the cash figures were stored.
      rows = summary.map((r) => ({
        id: r.payment_method_id,
        name: r.method_name,
        isCash: r.is_cash,
        isCredit: r.is_credit,
        opening: r.opening,
        received: r.received,
        expected: r.is_cash && session.closing_cash_expected != null ? Number(session.closing_cash_expected) : r.expected,
        counted: r.is_cash ? (session.closing_cash_actual != null ? Number(session.closing_cash_actual) : null) : null,
        difference: r.is_cash ? (session.difference != null ? Number(session.difference) : null) : null,
      }));
    }
  } else {
    rows = summary.map((r) => ({ id: r.payment_method_id, name: r.method_name, isCash: r.is_cash, isCredit: r.is_credit, opening: r.opening, received: r.received, expected: r.expected }));
  }

  return (
    <SessionDetailClient
      session={session}
      cashierName={names.get(session.cashier_id) ?? "—"}
      closedByName={session.closed_by ? names.get(session.closed_by) ?? "—" : null}
      rows={rows}
      summary={summary}
      transactions={(txns ?? []) as CashRegisterTransaction[]}
      payments={payments}
    />
  );
}
