import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { formatMVR } from "@/lib/utils";
import { BreakdownCharts, type BreakdownData } from "./charts";
import { maldivesStartOfDay, maldivesEndOfDay, maldivesDayLabel, maldivesStartOfMonth } from "@/lib/maldives-time";
import { SalesByDayChart, OrdersByDayChart } from "./charts";
import { BillHistory } from "./bill-history";
import { DollarSign, ShoppingBag, TrendingUp, Wallet, Package, AlertTriangle, XCircle, Users } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  const todayStart = maldivesStartOfDay(0).toISOString();
  const todayEnd = maldivesEndOfDay(0).toISOString();
  const weekStart = maldivesStartOfDay(6).toISOString();
  const monthStart = maldivesStartOfMonth(0).toISOString();
  const lastMonthStart = maldivesStartOfMonth(1).toISOString();

  const [
    { data: todayOrders },
    { data: weekOrders },
    { data: monthOrders },
    { data: lastMonthOrders },
    { data: todayExpenses },
    { count: totalProducts },
    { count: totalCustomers },
    { data: lowStockProducts },
    { data: recentOrders },
    { data: paymentMethods },
  ] = await Promise.all([
    supabase.from("orders").select("id,total,discount_amount,created_at,voided").gte("created_at", todayStart).lte("created_at", todayEnd).eq("voided", false),
    supabase.from("orders").select("id,total,created_at,voided").gte("created_at", weekStart).eq("voided", false),
    supabase.from("orders").select("id,total,created_at,voided").gte("created_at", monthStart).eq("voided", false),
    supabase.from("orders").select("id,total,created_at,voided").gte("created_at", lastMonthStart).lt("created_at", monthStart).eq("voided", false),
    supabase.from("expenses").select("amount").gte("expense_date", todayStart.slice(0, 10)).lte("expense_date", todayEnd.slice(0, 10)),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase.from("products").select("id,name,current_stock,minimum_stock").eq("active", true).eq("track_inventory", true),
    supabase
      .from("orders")
      .select("id,order_number,created_at,total,status,voided,cashier:profiles!orders_cashier_id_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("payment_methods").select("id,name").eq("enabled", true),
  ]);

  const { data: pendingVoidRequests } = await supabase
    .from("void_requests")
    .select("id,order_id,reason,created_at,order:orders(order_number,total),requester:profiles!void_requests_requested_by_fkey(full_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const isFinance = profile.role !== "cashier";

  const todaySales = (todayOrders ?? []).reduce((s, o) => s + Number(o.total), 0);
  const todayOrderCount = (todayOrders ?? []).length;
  const avgOrderValue = todayOrderCount ? todaySales / todayOrderCount : 0;
  const todayExpenseTotal = (todayExpenses ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const netSales = todaySales - todayExpenseTotal;

  const weekSales = (weekOrders ?? []).reduce((s, o) => s + Number(o.total), 0);
  const monthSales = (monthOrders ?? []).reduce((s, o) => s + Number(o.total), 0);
  const lastMonthSales = (lastMonthOrders ?? []).reduce((s, o) => s + Number(o.total), 0);

  const lowStock = (lowStockProducts ?? []).filter((p) => Number(p.current_stock) <= Number(p.minimum_stock) && Number(p.current_stock) > 0);
  const outOfStock = (lowStockProducts ?? []).filter((p) => Number(p.current_stock) <= 0);

  // Sales & orders by day, last 7 days
  const byDay: { day: string; sales: number; orders: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const start = maldivesStartOfDay(i);
    const end = maldivesEndOfDay(i);
    const dayOrders = (weekOrders ?? []).filter((o) => {
      const t = new Date(o.created_at).getTime();
      return t >= start.getTime() && t <= end.getTime();
    });
    byDay.push({
      day: maldivesDayLabel(start),
      sales: dayOrders.reduce((s, o) => s + Number(o.total), 0),
      orders: dayOrders.length,
    });
  }

  // Category + payment breakdowns per period (aggregated in the database)
  const nowIso = new Date(Date.now() + 60_000).toISOString();
  const periodRanges: Record<string, [string, string]> = {
    week: [weekStart, nowIso],
    month: [monthStart, nowIso],
    last_month: [lastMonthStart, monthStart],
    all: ["2000-01-01T00:00:00Z", nowIso],
  };
  const breakdown = {} as BreakdownData;
  await Promise.all(
    Object.entries(periodRanges).map(async ([key, [from, to]]) => {
      const { data } = await supabase.rpc("dashboard_breakdown", { p_from: from, p_to: to });
      const rows = ((data ?? []) as { kind: string; name: string; value: number }[]).map((r) => ({ kind: r.kind, name: r.name, value: Number(r.value) }));
      breakdown[key as keyof BreakdownData] = {
        category: rows.filter((r) => r.kind === "category").map(({ name, value }) => ({ name, value })),
        payment: rows.filter((r) => r.kind === "payment").map(({ name, value }) => ({ name, value })),
      };
    })
  );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={`Welcome back, ${profile.full_name?.split(" ")[0] || "there"}`}
        description="Here's how the takeaway is doing."
        actions={
          <Link href="/pos" className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
            Open POS
          </Link>
        }
      />

      <div className="space-y-4 px-4 sm:px-6">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Today</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <StatCard label="Today's Sales" value={formatMVR(todaySales)} icon={DollarSign} />
            <StatCard label="Orders" value={String(todayOrderCount)} icon={ShoppingBag} />
            <StatCard label="Avg Order Value" value={formatMVR(avgOrderValue)} icon={TrendingUp} />
            {isFinance && <StatCard label="Today's Expenses" value={formatMVR(todayExpenseTotal)} icon={Wallet} tone="warning" />}
            {isFinance && <StatCard label="Net Sales" value={formatMVR(netSales)} icon={DollarSign} tone="success" />}
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Quick stats</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total Products" value={String(totalProducts ?? 0)} icon={Package} />
            <StatCard label="Low Stock" value={String(lowStock.length)} icon={AlertTriangle} tone={lowStock.length ? "warning" : "default"} />
            <StatCard label="Out of Stock" value={String(outOfStock.length)} icon={XCircle} tone={outOfStock.length ? "destructive" : "default"} />
            <StatCard label="Total Customers" value={String(totalCustomers ?? 0)} icon={Users} />
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Sales summary</h2>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard label="Today" value={formatMVR(todaySales)} />
            <StatCard label="This Week" value={formatMVR(weekSales)} />
            <StatCard label="This Month" value={formatMVR(monthSales)} />
            <StatCard label="Last Month" value={formatMVR(lastMonthSales)} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SalesByDayChart data={byDay} />
          <OrdersByDayChart data={byDay} />
          <BreakdownCharts data={breakdown} />
        </div>

        <BillHistory
          orders={(recentOrders ?? []) as any}
          pendingRequests={(pendingVoidRequests ?? []) as any}
          canManage={isFinance}
        />
      </div>
    </div>
  );
}
