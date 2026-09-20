// Pure aggregation helpers for the Reports module. Kept dependency-free and
// framework-agnostic so the server component can compute once and pass plain
// data down to client components for display / CSV export.

import type { Expense, ExpenseCategory, Order, OrderItem, Payment, PaymentMethod, Product, Refund } from "@/types/database";

export interface SalesSummary {
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  orderCount: number;
  avgOrderValue: number;
  byDay: { date: string; orders: number; total: number }[];
}

export function buildSalesSummary(orders: Order[], refunds: Refund[]): SalesSummary {
  const grossSales = orders.reduce((sum, o) => sum + Number(o.subtotal), 0);
  const discounts = orders.reduce((sum, o) => sum + Number(o.discount_amount), 0);
  const refundsTotal = refunds.reduce((sum, r) => sum + Number(r.refund_amount), 0);
  const netSales = grossSales - discounts - refundsTotal;
  const orderCount = orders.length;
  const totalOrderValue = orders.reduce((sum, o) => sum + Number(o.total), 0);
  const avgOrderValue = orderCount ? totalOrderValue / orderCount : 0;

  const byDayMap = new Map<string, { orders: number; total: number }>();
  for (const o of orders) {
    const date = o.created_at.slice(0, 10);
    const entry = byDayMap.get(date) ?? { orders: 0, total: 0 };
    entry.orders += 1;
    entry.total += Number(o.total);
    byDayMap.set(date, entry);
  }
  const byDay = Array.from(byDayMap.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return { grossSales, discounts, refunds: refundsTotal, netSales, orderCount, avgOrderValue, byDay };
}

export interface ProductSalesRow {
  productId: string;
  productName: string;
  categoryId: string | null;
  categoryName: string;
  quantity: number;
  revenue: number;
  estCost: number;
  estProfit: number;
}

export function buildProductSales(items: OrderItem[], products: Product[], categoryNames: Map<string, string>): ProductSalesRow[] {
  const productMap = new Map(products.map((p) => [p.id, p]));
  const rows = new Map<string, ProductSalesRow>();

  for (const item of items) {
    const key = item.product_id ?? item.product_name;
    const product = item.product_id ? productMap.get(item.product_id) : undefined;
    const categoryId = product?.category_id ?? null;
    const existing = rows.get(key) ?? {
      productId: key,
      productName: item.product_name,
      categoryId,
      categoryName: categoryId ? categoryNames.get(categoryId) ?? "Uncategorized" : "Uncategorized",
      quantity: 0,
      revenue: 0,
      estCost: 0,
      estProfit: 0,
    };
    existing.quantity += Number(item.quantity);
    existing.revenue += Number(item.line_total);
    const costPrice = product ? Number(product.cost_price) : 0;
    existing.estCost += costPrice * Number(item.quantity);
    rows.set(key, existing);
  }

  const result = Array.from(rows.values()).map((r) => ({ ...r, estProfit: r.revenue - r.estCost }));
  result.sort((a, b) => b.revenue - a.revenue);
  return result;
}

export interface CategorySalesRow {
  categoryId: string;
  categoryName: string;
  quantity: number;
  revenue: number;
}

export function buildCategorySales(productSales: ProductSalesRow[]): CategorySalesRow[] {
  const rows = new Map<string, CategorySalesRow>();
  for (const p of productSales) {
    const key = p.categoryId ?? "uncategorized";
    const existing = rows.get(key) ?? { categoryId: key, categoryName: p.categoryName, quantity: 0, revenue: 0 };
    existing.quantity += p.quantity;
    existing.revenue += p.revenue;
    rows.set(key, existing);
  }
  return Array.from(rows.values()).sort((a, b) => b.revenue - a.revenue);
}

export interface PaymentReportRow {
  methodId: string;
  methodName: string;
  amount: number;
  count: number;
}

export function buildPaymentReport(payments: Payment[], methods: PaymentMethod[]): PaymentReportRow[] {
  const methodMap = new Map(methods.map((m) => [m.id, m.name]));
  const rows = new Map<string, PaymentReportRow>();
  for (const p of payments) {
    const existing = rows.get(p.payment_method_id) ?? {
      methodId: p.payment_method_id,
      methodName: methodMap.get(p.payment_method_id) ?? "Unknown",
      amount: 0,
      count: 0,
    };
    existing.amount += Number(p.amount);
    existing.count += 1;
    rows.set(p.payment_method_id, existing);
  }
  return Array.from(rows.values()).sort((a, b) => b.amount - a.amount);
}

export interface ExpenseReportRow {
  categoryId: string;
  categoryName: string;
  amount: number;
  count: number;
}

export function buildExpenseReport(expenses: Expense[], categories: ExpenseCategory[]): ExpenseReportRow[] {
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const rows = new Map<string, ExpenseReportRow>();
  for (const e of expenses) {
    const key = e.category_id ?? "uncategorized";
    const existing = rows.get(key) ?? {
      categoryId: key,
      categoryName: e.category_id ? categoryMap.get(e.category_id) ?? "Unknown" : "Uncategorized",
      amount: 0,
      count: 0,
    };
    existing.amount += Number(e.amount);
    existing.count += 1;
    rows.set(key, existing);
  }
  return Array.from(rows.values()).sort((a, b) => b.amount - a.amount);
}

export interface InventoryReportRow {
  productId: string;
  productName: string;
  currentStock: number;
  minimumStock: number;
  costPrice: number;
  stockValue: number;
}

export function buildInventoryReport(products: Product[]): {
  all: InventoryReportRow[];
  lowStock: InventoryReportRow[];
  outOfStock: InventoryReportRow[];
  totalStockValue: number;
} {
  const all: InventoryReportRow[] = products
    .filter((p) => p.track_inventory)
    .map((p) => ({
      productId: p.id,
      productName: p.name,
      currentStock: Number(p.current_stock),
      minimumStock: Number(p.minimum_stock),
      costPrice: Number(p.cost_price),
      stockValue: Number(p.current_stock) * Number(p.cost_price),
    }));
  const outOfStock = all.filter((p) => p.currentStock <= 0);
  const lowStock = all.filter((p) => p.currentStock > 0 && p.currentStock <= p.minimumStock);
  const totalStockValue = all.reduce((sum, p) => sum + p.stockValue, 0);
  return { all, lowStock, outOfStock, totalStockValue };
}

export interface ProfitEstimate {
  netSales: number;
  cogs: number;
  expenses: number;
  netProfit: number;
}

export function buildProfitEstimate(salesSummary: SalesSummary, productSales: ProductSalesRow[], expenseTotal: number): ProfitEstimate {
  const cogs = productSales.reduce((sum, p) => sum + p.estCost, 0);
  const netProfit = salesSummary.netSales - cogs - expenseTotal;
  return { netSales: salesSummary.netSales, cogs, expenses: expenseTotal, netProfit };
}
