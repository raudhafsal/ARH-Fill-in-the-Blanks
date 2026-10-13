import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Category, Expense, ExpenseCategory, Order, OrderItem, Payment, PaymentMethod, Product, Refund } from "@/types/database";
import { thisMonthRange, startOfDayIso, endOfDayIso } from "@/lib/date-range";
import {
  buildCategorySales,
  buildExpenseReport,
  buildInventoryReport,
  buildPaymentReport,
  buildProductSales,
  buildProfitEstimate,
  buildSalesSummary,
} from "@/lib/reports";
import { ReportsClient } from "./reports-client";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const profile = await requireRole(["administrator", "manager"]);
  const supabase = createClient();

  const defaults = thisMonthRange();
  const from = searchParams.from || defaults.from;
  const to = searchParams.to || defaults.to;
  const fromIso = startOfDayIso(from);
  const toIso = endOfDayIso(to);

  const [
    { data: ordersRaw },
    { data: refundsRaw },
    { data: paymentsRaw },
    { data: expensesRaw },
    { data: productsRaw },
    { data: categoriesRaw },
    { data: paymentMethodsRaw },
    { data: expenseCategoriesRaw },
    { data: purchasesRaw },
    { data: suppliersRaw },
    { data: bizSettings },
    { data: sigRow },
  ] = await Promise.all([
    supabase.from("orders").select("*").gte("created_at", fromIso).lte("created_at", toIso).order("created_at"),
    supabase.from("refunds").select("*").gte("created_at", fromIso).lte("created_at", toIso),
    supabase.from("payments").select("*").gte("created_at", fromIso).lte("created_at", toIso),
    supabase.from("expenses").select("*").gte("expense_date", from).lte("expense_date", to),
    supabase.from("products").select("*"),
    supabase.from("categories").select("*"),
    supabase.from("payment_methods").select("*"),
    supabase.from("expense_categories").select("*"),
    supabase.from("purchases").select("id,supplier_id,total_cost,purchase_date,status").eq("status", "received").gte("purchase_date", from).lte("purchase_date", to),
    supabase.from("suppliers").select("id,name"),
    supabase.from("business_settings").select("business_name").maybeSingle(),
    supabase.from("user_signatures").select("image_data").eq("user_id", profile.id).maybeSingle(),
  ]);

  const orders = (ordersRaw ?? []) as Order[];
  const validOrders = orders.filter((o) => !o.voided && o.status !== "cancelled");
  const orderIds = validOrders.map((o) => o.id);

  const { data: orderItemsRaw } =
    orderIds.length > 0
      ? await supabase.from("order_items").select("*").in("order_id", orderIds)
      : { data: [] as OrderItem[] };

  const refunds = (refundsRaw ?? []) as Refund[];
  // Only payments of orders that count (not voided/cancelled) — otherwise voided sales inflate the totals.
  const validOrderIds = new Set(orderIds);
  const payments = ((paymentsRaw ?? []) as Payment[]).filter((p) => validOrderIds.has(p.order_id));
  const expenses = (expensesRaw ?? []) as Expense[];
  const products = (productsRaw ?? []) as Product[];
  const categories = (categoriesRaw ?? []) as Category[];
  const paymentMethods = (paymentMethodsRaw ?? []) as PaymentMethod[];
  const expenseCategories = (expenseCategoriesRaw ?? []) as ExpenseCategory[];
  const orderItems = (orderItemsRaw ?? []) as OrderItem[];

  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));

  const salesSummary = buildSalesSummary(validOrders, refunds);
  const productSales = buildProductSales(orderItems, products, categoryNames);
  const categorySales = buildCategorySales(productSales);
  const paymentReport = buildPaymentReport(payments, paymentMethods);
  const expenseReport = buildExpenseReport(expenses, expenseCategories);
  const expenseTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  // Purchases (stock bought from suppliers) are kept separate from operating expenses.
  const supplierNames = new Map(((suppliersRaw ?? []) as { id: string; name: string }[]).map((x) => [x.id, x.name]));
  const purchaseMap = new Map<string, { supplierName: string; count: number; amount: number }>();
  for (const pu of (purchasesRaw ?? []) as { supplier_id: string | null; total_cost: number }[]) {
    const key = pu.supplier_id ?? "none";
    const row = purchaseMap.get(key) ?? { supplierName: pu.supplier_id ? supplierNames.get(pu.supplier_id) ?? "Unknown supplier" : "No supplier", count: 0, amount: 0 };
    row.count += 1;
    row.amount += Number(pu.total_cost);
    purchaseMap.set(key, row);
  }
  const purchaseReport = Array.from(purchaseMap.values()).sort((a, b) => b.amount - a.amount);
  const purchaseTotal = purchaseReport.reduce((sum, r) => sum + r.amount, 0);
  const inventoryReport = buildInventoryReport(products);
  const profitEstimate = buildProfitEstimate(salesSummary, productSales, expenseTotal);

  return (
    <ReportsClient
      businessName={bizSettings?.business_name ?? "ARH Fill in the Blanks"}
      preparedBy={{ name: profile.full_name, role: profile.role }}
      signature={sigRow?.image_data ?? null}
      from={from}
      to={to}
      salesSummary={salesSummary}
      productSales={productSales}
      categorySales={categorySales}
      paymentReport={paymentReport}
      expenseReport={expenseReport}
      expenseTotal={expenseTotal}
      purchaseReport={purchaseReport}
      purchaseTotal={purchaseTotal}
      inventoryReport={inventoryReport}
      profitEstimate={profitEstimate}
    />
  );
}
