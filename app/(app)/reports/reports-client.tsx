"use client";

import { PageHeader } from "@/components/shared/page-header";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMVR, formatMaldivesDate } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv-export";
import type {
  CategorySalesRow,
  ExpenseReportRow,
  InventoryReportRow,
  PaymentReportRow,
  ProductSalesRow,
  ProfitEstimate,
  SalesSummary,
} from "@/lib/reports";
import { Download, TrendingUp, Package, Tags, CreditCard, Wallet, Boxes, PiggyBank } from "lucide-react";

export function ReportsClient({
  from,
  to,
  salesSummary,
  productSales,
  categorySales,
  paymentReport,
  expenseReport,
  expenseTotal,
  inventoryReport,
  profitEstimate,
}: {
  from: string;
  to: string;
  salesSummary: SalesSummary;
  productSales: ProductSalesRow[];
  categorySales: CategorySalesRow[];
  paymentReport: PaymentReportRow[];
  expenseReport: ExpenseReportRow[];
  expenseTotal: number;
  inventoryReport: { all: InventoryReportRow[]; lowStock: InventoryReportRow[]; outOfStock: InventoryReportRow[]; totalStockValue: number };
  profitEstimate: ProfitEstimate;
}) {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Business performance for the selected date range. Use your browser's Print → Save as PDF to export any report view."
      />

      <div className="space-y-4 p-4 sm:p-6">
        <Card className="p-4">
          <DateRangePicker from={from} to={to} />
        </Card>

        <Tabs defaultValue="sales">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="profit">Profit Estimate</TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Gross sales" value={formatMVR(salesSummary.grossSales)} icon={TrendingUp} />
              <StatCard label="Discounts" value={formatMVR(salesSummary.discounts)} />
              <StatCard label="Refunds" value={formatMVR(salesSummary.refunds)} />
              <StatCard label="Net sales" value={formatMVR(salesSummary.netSales)} tone="success" />
              <StatCard label="Orders" value={String(salesSummary.orderCount)} />
              <StatCard label="Avg order value" value={formatMVR(salesSummary.avgOrderValue)} />
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsv(`sales-report-${from}-to-${to}`, salesSummary.byDay, [
                    { header: "Date", accessor: (r) => r.date },
                    { header: "Orders", accessor: (r) => r.orders },
                    { header: "Total", accessor: (r) => r.total.toFixed(2) },
                  ])
                }
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
            {salesSummary.byDay.length === 0 ? (
              <EmptyState icon={TrendingUp} title="No sales in this range" />
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesSummary.byDay.map((d) => (
                      <TableRow key={d.date}>
                        <TableCell>{formatMaldivesDate(d.date)}</TableCell>
                        <TableCell className="text-right">{d.orders}</TableCell>
                        <TableCell className="text-right font-medium">{formatMVR(d.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="products" className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Cost and profit are estimates based on each product&apos;s current cost price (not a historical snapshot).
            </p>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsv(`product-sales-${from}-to-${to}`, productSales, [
                    { header: "Product", accessor: (r) => r.productName },
                    { header: "Category", accessor: (r) => r.categoryName },
                    { header: "Quantity sold", accessor: (r) => r.quantity },
                    { header: "Revenue", accessor: (r) => r.revenue.toFixed(2) },
                    { header: "Estimated cost", accessor: (r) => r.estCost.toFixed(2) },
                    { header: "Estimated profit", accessor: (r) => r.estProfit.toFixed(2) },
                  ])
                }
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
            {productSales.length === 0 ? (
              <EmptyState icon={Package} title="No product sales in this range" />
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Qty sold</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Est. cost</TableHead>
                      <TableHead className="text-right">Est. profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productSales.map((p) => (
                      <TableRow key={p.productId}>
                        <TableCell className="font-medium">{p.productName}</TableCell>
                        <TableCell>{p.categoryName}</TableCell>
                        <TableCell className="text-right">{p.quantity}</TableCell>
                        <TableCell className="text-right">{formatMVR(p.revenue)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatMVR(p.estCost)}</TableCell>
                        <TableCell className="text-right font-medium">{formatMVR(p.estProfit)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsv(`category-sales-${from}-to-${to}`, categorySales, [
                    { header: "Category", accessor: (r) => r.categoryName },
                    { header: "Quantity sold", accessor: (r) => r.quantity },
                    { header: "Revenue", accessor: (r) => r.revenue.toFixed(2) },
                  ])
                }
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
            {categorySales.length === 0 ? (
              <EmptyState icon={Tags} title="No category sales in this range" />
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Qty sold</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categorySales.map((c) => (
                      <TableRow key={c.categoryId}>
                        <TableCell className="font-medium">{c.categoryName}</TableCell>
                        <TableCell className="text-right">{c.quantity}</TableCell>
                        <TableCell className="text-right font-medium">{formatMVR(c.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsv(`payment-report-${from}-to-${to}`, paymentReport, [
                    { header: "Payment method", accessor: (r) => r.methodName },
                    { header: "Count", accessor: (r) => r.count },
                    { header: "Amount", accessor: (r) => r.amount.toFixed(2) },
                  ])
                }
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
            {paymentReport.length === 0 ? (
              <EmptyState icon={CreditCard} title="No payments in this range" />
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment method</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentReport.map((p) => (
                      <TableRow key={p.methodId}>
                        <TableCell className="font-medium">{p.methodName}</TableCell>
                        <TableCell className="text-right">{p.count}</TableCell>
                        <TableCell className="text-right font-medium">{formatMVR(p.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="expenses" className="space-y-4">
            <StatCard label="Total expenses" value={formatMVR(expenseTotal)} icon={Wallet} />
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsv(`expense-report-${from}-to-${to}`, expenseReport, [
                    { header: "Category", accessor: (r) => r.categoryName },
                    { header: "Count", accessor: (r) => r.count },
                    { header: "Amount", accessor: (r) => r.amount.toFixed(2) },
                  ])
                }
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
            {expenseReport.length === 0 ? (
              <EmptyState icon={Wallet} title="No expenses in this range" />
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseReport.map((e) => (
                      <TableRow key={e.categoryId}>
                        <TableCell className="font-medium">{e.categoryName}</TableCell>
                        <TableCell className="text-right">{e.count}</TableCell>
                        <TableCell className="text-right font-medium">{formatMVR(e.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Snapshot of current stock — this tab ignores the selected date range.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard label="Total stock value" value={formatMVR(inventoryReport.totalStockValue)} icon={Boxes} />
              <StatCard label="Low stock items" value={String(inventoryReport.lowStock.length)} tone="warning" />
              <StatCard label="Out of stock items" value={String(inventoryReport.outOfStock.length)} tone="destructive" />
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsv(`inventory-report-${from}`, inventoryReport.all, [
                    { header: "Product", accessor: (r) => r.productName },
                    { header: "Current stock", accessor: (r) => r.currentStock },
                    { header: "Minimum stock", accessor: (r) => r.minimumStock },
                    { header: "Cost price", accessor: (r) => r.costPrice.toFixed(2) },
                    { header: "Stock value", accessor: (r) => r.stockValue.toFixed(2) },
                  ])
                }
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
            {inventoryReport.all.length === 0 ? (
              <EmptyState icon={Boxes} title="No tracked inventory products" />
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Current stock</TableHead>
                      <TableHead className="text-right">Minimum</TableHead>
                      <TableHead className="text-right">Cost price</TableHead>
                      <TableHead className="text-right">Stock value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventoryReport.all.map((p) => (
                      <TableRow key={p.productId}>
                        <TableCell className="font-medium">{p.productName}</TableCell>
                        <TableCell
                          className={
                            "text-right " +
                            (p.currentStock <= 0 ? "text-destructive" : p.currentStock <= p.minimumStock ? "text-warning" : "")
                          }
                        >
                          {p.currentStock}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{p.minimumStock}</TableCell>
                        <TableCell className="text-right">{formatMVR(p.costPrice)}</TableCell>
                        <TableCell className="text-right font-medium">{formatMVR(p.stockValue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="profit" className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              <strong>Estimate.</strong> Profit figures are estimates based on current product cost prices and do not account
              for non-inventory costs.
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Net sales" value={formatMVR(profitEstimate.netSales)} icon={TrendingUp} />
              <StatCard label="Cost of goods (est.)" value={formatMVR(profitEstimate.cogs)} />
              <StatCard label="Expenses" value={formatMVR(profitEstimate.expenses)} />
              <StatCard
                label="Estimated net profit"
                value={formatMVR(profitEstimate.netProfit)}
                icon={PiggyBank}
                tone={profitEstimate.netProfit >= 0 ? "success" : "destructive"}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
