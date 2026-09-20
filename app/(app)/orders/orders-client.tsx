"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatMVR, formatMaldivesDate, formatMaldivesTime } from "@/lib/utils";
import type { OrderType, PaymentMethod, Profile } from "@/types/database";
import { Receipt as ReceiptIcon, X } from "lucide-react";

interface OrderRow {
  id: string;
  order_number: string;
  created_at: string;
  order_type: OrderType;
  status: string;
  voided: boolean;
  total: number;
  sync_status: string;
  cashier: { full_name: string } | null;
  customer: { full_name: string } | null;
  payments: { amount: number; payment_method: { id: string; name: string } | null }[];
}

export function OrdersClient({
  profile,
  paymentMethods,
  cashiers,
  isManager,
}: {
  profile: Profile;
  paymentMethods: PaymentMethod[];
  cashiers: { id: string; full_name: string }[];
  isManager: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [cashierId, setCashierId] = useState<string>("all");
  const [paymentMethodId, setPaymentMethodId] = useState<string>("all");
  const [orderType, setOrderType] = useState<string>("all");
  const [customerQuery, setCustomerQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      let query = supabase
        .from("orders")
        .select(
          "id, order_number, created_at, order_type, status, voided, total, sync_status, cashier:profiles!orders_cashier_id_fkey(full_name), customer:customers(full_name), payments(amount, payment_method:payment_methods(id, name))"
        )
        .order("created_at", { ascending: false })
        .limit(200);

      if (dateFrom) query = query.gte("created_at", new Date(dateFrom + "T00:00:00").toISOString());
      if (dateTo) query = query.lte("created_at", new Date(dateTo + "T23:59:59").toISOString());
      if (orderNumber.trim()) query = query.ilike("order_number", `%${orderNumber.trim()}%`);
      if (isManager && cashierId !== "all") query = query.eq("cashier_id", cashierId);
      if (orderType !== "all") query = query.eq("order_type", orderType);

      const { data, error } = await query;
      if (!cancelled) {
        if (!error) setOrders((data ?? []) as unknown as OrderRow[]);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, orderNumber, cashierId, orderType, isManager]);

  const filtered = orders.filter((o) => {
    if (paymentMethodId !== "all" && !o.payments.some((p) => p.payment_method?.id === paymentMethodId)) return false;
    if (customerQuery.trim() && !(o.customer?.full_name ?? "").toLowerCase().includes(customerQuery.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <PageHeader title="Orders" description="Sales history and receipts." />

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Order #</Label>
            <Input placeholder="ARH-000123" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
          </div>
          {isManager && (
            <div className="space-y-1">
              <Label className="text-xs">Cashier</Label>
              <Select value={cashierId} onValueChange={setCashierId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cashiers</SelectItem>
                  {cashiers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Payment method</Label>
            <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All methods</SelectItem>
                {paymentMethods.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Order type</Label>
            <Select value={orderType} onValueChange={setOrderType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="takeaway">Takeaway</SelectItem>
                <SelectItem value="pickup">Pickup</SelectItem>
                <SelectItem value="dine_in">Dine-in</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1 sm:col-span-3 lg:col-span-2">
            <Label className="text-xs">Customer</Label>
            <Input placeholder="Search by customer name" value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setOrderNumber("");
                setCashierId("all");
                setPaymentMethodId("all");
                setOrderType("all");
                setCustomerQuery("");
              }}
            >
              <X className="h-3.5 w-3.5" /> Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 sm:p-0">
          {loading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Loading orders…</p>
          ) : filtered.length === 0 ? (
            <EmptyState icon={ReceiptIcon} title="No orders found" description="Try widening your filters." className="border-none" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Date/Time</TableHead>
                  {isManager && <TableHead>Cashier</TableHead>}
                  <TableHead>Type</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => (
                  <TableRow key={o.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link href={`/orders/${o.id}`} className="hover:underline">
                        {o.order_number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {formatMaldivesDate(o.created_at)} {formatMaldivesTime(o.created_at)}
                    </TableCell>
                    {isManager && <TableCell>{o.cashier?.full_name ?? "—"}</TableCell>}
                    <TableCell className="capitalize">{o.order_type.replace("_", " ")}</TableCell>
                    <TableCell>{o.payments.map((p) => p.payment_method?.name).filter(Boolean).join(", ") || "—"}</TableCell>
                    <TableCell className="text-right">{formatMVR(o.total)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {o.voided ? (
                          <Badge variant="destructive">Voided</Badge>
                        ) : (
                          <Badge variant="success" className="capitalize">
                            {o.status}
                          </Badge>
                        )}
                        {o.sync_status === "pending" && <Badge variant="warning">Pending Sync</Badge>}
                        {o.sync_status === "failed" && <Badge variant="destructive">Sync Failed</Badge>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
