import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { CashRegister, Order, Profile, Refund } from "@/types/database";
import { thisMonthRange, startOfDayIso, endOfDayIso } from "@/lib/date-range";
import { StaffClient } from "./staff-client";

export const dynamic = "force-dynamic";

export interface StaffRow {
  profileId: string;
  fullName: string;
  role: Profile["role"];
  orderCount: number;
  totalSales: number;
  discounts: number;
  refunds: number;
  registerDifference: number;
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  await requireRole(["administrator", "manager"]);
  const supabase = createClient();

  const defaults = thisMonthRange();
  const from = searchParams.from || defaults.from;
  const to = searchParams.to || defaults.to;
  const fromIso = startOfDayIso(from);
  const toIso = endOfDayIso(to);

  const [{ data: profilesRaw }, { data: ordersRaw }, { data: refundsRaw }, { data: registersRaw }] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("orders").select("*").gte("created_at", fromIso).lte("created_at", toIso),
    supabase.from("refunds").select("*").gte("created_at", fromIso).lte("created_at", toIso),
    supabase
      .from("cash_registers")
      .select("*")
      .eq("status", "closed")
      .gte("closed_at", fromIso)
      .lte("closed_at", toIso),
  ]);

  const profiles = (profilesRaw ?? []) as Profile[];
  const orders = ((ordersRaw ?? []) as Order[]).filter((o) => !o.voided && o.status !== "cancelled");
  const refunds = (refundsRaw ?? []) as Refund[];
  const registers = (registersRaw ?? []) as CashRegister[];

  const rows: StaffRow[] = profiles.map((p) => {
    const staffOrders = orders.filter((o) => o.cashier_id === p.id);
    const staffRefunds = refunds.filter((r) => r.created_by === p.id);
    const staffRegisters = registers.filter((r) => r.cashier_id === p.id);
    return {
      profileId: p.id,
      fullName: p.full_name,
      role: p.role,
      orderCount: staffOrders.length,
      totalSales: staffOrders.reduce((sum, o) => sum + Number(o.total), 0),
      discounts: staffOrders.reduce((sum, o) => sum + Number(o.discount_amount), 0),
      refunds: staffRefunds.reduce((sum, r) => sum + Number(r.refund_amount), 0),
      registerDifference: staffRegisters.reduce((sum, r) => sum + Number(r.difference ?? 0), 0),
    };
  });

  return <StaffClient rows={rows} from={from} to={to} />;
}
