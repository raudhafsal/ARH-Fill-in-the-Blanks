import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Supplier, Product, Purchase, PurchaseItem } from "@/types/database";
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

  const [{ data: purchase }, { data: items }, { data: suppliers }, { data: products }, { data: businessSettings }] = await Promise.all([
    supabase.from("purchases").select("*, supplier:suppliers(name, address, phone, email)").eq("id", params.id).single(),
    supabase.from("purchase_items").select("*, product:products(name)").eq("purchase_id", params.id),
    supabase.from("suppliers").select("*").order("name", { ascending: true }),
    supabase.from("products").select("*").order("name", { ascending: true }),
    supabase.from("business_settings").select("*").maybeSingle(),
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
          <div className="hidden items-center gap-3 border-b pb-4 print:flex">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-mark.png" alt="" className="h-12 w-12 object-contain" />
            <div>
              <p className="text-lg font-bold">{businessSettings?.business_name ?? "ARH Fill in the Blank"}</p>
              {businessSettings?.address && <p className="text-xs text-muted-foreground">{businessSettings.address}</p>}
              {businessSettings?.phone && <p className="text-xs text-muted-foreground">{businessSettings.phone}</p>}
            </div>
            <div className="ml-auto text-right text-xs text-muted-foreground">
              <p className="text-sm font-semibold uppercase tracking-wide">Purchase Order</p>
              {purchase.supplier?.name && <p>Supplier: {purchase.supplier.name}</p>}
              {(purchase.supplier as any)?.phone && <p>{(purchase.supplier as any).phone}</p>}
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
                      <TableCell>{i.quantity}</TableCell>
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
        </div>
      </div>
    );
  }

  return (
    <PurchaseForm
      mode="edit"
      suppliers={(suppliers ?? []) as Supplier[]}
      products={(products ?? []) as Product[]}
      existingPurchase={purchase as Purchase}
      existingItems={(items ?? []) as PurchaseItem[]}
    />
  );
}
