"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { formatMVR, formatMaldivesDate, formatMaldivesTime } from "@/lib/utils";
import { Eye, Ban, Loader2, ShieldAlert, Check, X, Receipt } from "lucide-react";

interface OrderRow {
  id: string;
  order_number: string;
  created_at: string;
  total: number;
  status: string;
  voided: boolean;
  cashier: { full_name: string } | null;
}

interface PendingVoidRequest {
  id: string;
  order_id: string;
  reason: string;
  created_at: string;
  order: { order_number: string; total: number } | null;
  requester: { full_name: string } | null;
}

export function BillHistory({
  orders,
  pendingRequests,
  canManage,
}: {
  orders: OrderRow[];
  pendingRequests: PendingVoidRequest[];
  canManage: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const pendingByOrderId = useMemo(() => {
    const map = new Map<string, PendingVoidRequest>();
    for (const r of pendingRequests) map.set(r.order_id, r);
    return map;
  }, [pendingRequests]);

  const [voidTarget, setVoidTarget] = useState<OrderRow | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [reviewing, setReviewing] = useState<"approve" | "reject" | null>(null);

  function openVoidDialog(order: OrderRow) {
    setVoidTarget(order);
    setVoidReason("");
  }

  async function submitVoid() {
    if (!voidTarget) return;
    if (!voidReason.trim()) {
      toast.error("A reason is required.");
      return;
    }
    setSubmitting(true);
    try {
      if (canManage) {
        const { error } = await supabase.rpc("void_order", { p_order_id: voidTarget.id, p_reason: voidReason.trim() });
        if (error) throw error;
        toast.success("Bill voided.");
      } else {
        const { error } = await supabase.rpc("request_void_order", { p_order_id: voidTarget.id, p_reason: voidReason.trim() });
        if (error) throw error;
        toast.success("Void request sent — a manager or administrator needs to approve it.");
      }
      setVoidTarget(null);
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Unable to process this request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReview(request: PendingVoidRequest, action: "approve" | "reject") {
    setReviewing(action);
    try {
      const { error } = await supabase.rpc(action === "approve" ? "approve_void_request" : "reject_void_request", {
        p_request_id: request.id,
      });
      if (error) throw error;
      toast.success(action === "approve" ? "Void request approved — bill voided." : "Void request rejected.");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Unable to process this request. Please try again.");
    } finally {
      setReviewing(null);
    }
  }

  return (
    <div className="space-y-4">
      {canManage && pendingRequests.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-warning" />
              Pending void requests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0">
            {pendingRequests.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {r.order?.order_number ?? "—"} <span className="text-muted-foreground">· {formatMVR(r.order?.total ?? 0)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Requested by {r.requester?.full_name ?? "—"} — &ldquo;{r.reason}&rdquo;
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => handleReview(r, "reject")}
                    disabled={reviewing !== null}
                  >
                    {reviewing === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                    Reject
                  </Button>
                  <Button size="sm" className="gap-1.5" onClick={() => handleReview(r, "approve")} disabled={reviewing !== null}>
                    {reviewing === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Approve void
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          {orders.length === 0 ? (
            <EmptyState icon={Receipt} title="No orders yet" description="Sales will show up here as soon as you make one." className="border-none" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Cashier</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => {
                  const pending = pendingByOrderId.get(o.id);
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.order_number}</TableCell>
                      <TableCell>
                        {formatMaldivesDate(o.created_at)} {formatMaldivesTime(o.created_at)}
                      </TableCell>
                      <TableCell>{o.cashier?.full_name ?? "—"}</TableCell>
                      <TableCell>{formatMVR(o.total)}</TableCell>
                      <TableCell>
                        {o.voided ? (
                          <Badge variant="destructive">Voided</Badge>
                        ) : pending ? (
                          <Badge variant="warning">Void requested</Badge>
                        ) : (
                          <Badge variant="success" className="capitalize">
                            {o.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild aria-label="View bill">
                            <Link href={`/orders/${o.id}`}>
                              <Eye className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          {!o.voided && !pending && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => openVoidDialog(o)}
                              aria-label={canManage ? "Void bill" : "Request void"}
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!voidTarget} onOpenChange={(open) => !open && setVoidTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{canManage ? `Void bill ${voidTarget?.order_number}` : `Request void — ${voidTarget?.order_number}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {!canManage && (
              <p className="text-sm text-muted-foreground">
                This will send a request to a manager or administrator. The bill stays active until they approve it.
              </p>
            )}
            <Label htmlFor="void-reason">Reason</Label>
            <Textarea
              id="void-reason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              rows={3}
              placeholder={canManage ? "Why is this bill being voided?" : "Why should this bill be voided?"}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidTarget(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submitVoid} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {canManage ? "Void bill" : "Send request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
