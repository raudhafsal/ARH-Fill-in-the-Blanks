import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Supplier, Product, Purchase, PurchaseItem, ProductUnit } from "@/types/database";
import { PurchaseForm } from "../purchase-form";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";
import { formatMVR, formatMaldivesDate, formatMaldivesDateTime } from "@/lib/utils";
import { PrintButton } from "@/components/shared/print-button";

export const dynamic = "force-dynamic";

const statusVariant: Record<string, "secondary" | "success" | "destructive"> = {
  draft: "secondary",
  received: "success",
  cancelled: "destructive",
};

export default async function PurchaseDetailPage({ params }: { params: { id: string } }) {
  await requireRole(["administrator", "manager"]);
  const supabase = createClient();

  const [{ data: purchase }, { data: items }, { data: suppliers }, { data: products }, { data: businessSettings }, { data: productUnits }] = await Promise.all([
    supabase.from("purchases").select("*, supplier:suppliers(name, address, phone, email)").eq("id", params.id).single(),
    supabase.from("purchase_items").select("*, product:products(name)").eq("purchase_id", params.id),
    supabase.from("suppliers").select("*").order("name", { ascending: true }),
    supabase.from("products").select("*").order("name", { ascending: true }),
    supabase.from("business_settings").select("*").maybeSingle(),
    supabase.from("product_units").select("*"),
  ]);

  if (!purchase) notFound();

  if (purchase.status !== "draft") {
    const typedItems = (items ?? []) as (PurchaseItem & { product: { name: string } | null })[];
    return (
      <div>
        <PageHeader
          title={`Purchase — ${purchase.supplier?.name ?? "Unknown supplier"}`}
          description={formatMaldivesDate(purchase.purchase_date)}
          actions={
            <div className="flex gap-2">
              <PrintButton label="Print purchase order" />
              <Button variant="outline" asChild className="no-print">
                <Link href="/purchases">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Link>
              </Button>
            </div>
          }
        />
        <div id="po-print-area" className="space-y-4 p-4 sm:p-6">
          <div className="hidden print:block">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo-mark.png" alt="" className="h-10 w-10 object-contain" />
              <div>
                <p className="text-sm font-semibold">{businessSettings?.business_name ?? "ARH Fill in the Blanks"}</p>
                {businessSettings?.address && <p className="text-[10px]">{businessSettings.address}</p>}
                {businessSettings?.phone && <p className="text-[10px]">{businessSettings.phone}</p>}
              </div>
            </div>
            <div className="doc-title-block mt-3">
              <p className="text-xl font-bold">Purchase Order {purchase.invoice_number ?? ""}</p>
              <p className="text-sm">Date: {formatMaldivesDate(purchase.purchase_date)}</p>
              <p className="text-sm">Supplier: {purchase.supplier?.name ?? "—"}{(purchase.supplier as any)?.phone ? ` · ${(purchase.supplier as any).phone}` : ""}</p>
              <p className="text-sm capitalize">Status: {purchase.status}</p>
            </div>
          </div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Details</CardTitle>
              <Badge variant={statusVariant[purchase.status]} className="capitalize">
                {purchase.status}
              </Badge>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Invoice: </span>
                {purchase.invoice_number ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Payment status: </span>
                <span className="capitalize">{purchase.payment_status}</span>
              </p>
              {purchase.received_at && (
                <p>
                  <span className="text-muted-foreground">Received at: </span>
                  {formatMaldivesDateTime(purchase.received_at)}
                </p>
              )}
              {purchase.notes && (
                <p className="sm:col-span-2">
                  <span className="text-muted-foreground">Notes: </span>
                  {purchase.notes}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Line items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Cost price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typedItems.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.product?.name ?? "—"}</TableCell>
                      <TableCell>
                        {i.entered_quantity && i.unit_name && i.unit_name !== (products ?? []).find((p) => p.id === i.product_id)?.unit ? (
                          <>
                            {i.entered_quantity} {i.unit_name}{" "}
                            <span className="text-xs text-muted-foreground">({i.quantity})</span>
                          </>
                        ) : (
                          i.quantity
                        )}
                      </TableCell>
                      <TableCell>{formatMVR(i.cost_price)}</TableCell>
                      <TableCell className="text-right">{formatMVR(i.total_cost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-3 flex justify-end border-t pt-3 text-base font-semibold">
                Total: {formatMVR(purchase.total_cost)}
              </div>
            </CardContent>
          </Card>
          <p className="hidden pt-6 text-center text-[10px] print:block">
            Generated at {formatMaldivesDateTime(new Date().toISOString())}
          </p>
        </div>
      </div>
    );
  }

  return (
    <PurchaseForm
      mode="edit"
      suppliers={(suppliers ?? []) as Supplier[]}
      products={(products ?? []) as Product[]}
      productUnits={(productUnits ?? []) as ProductUnit[]}
      existingPurchase={purchase as Purchase}
      existingItems={(items ?? []) as PurchaseItem[]}
    />
  );
}
