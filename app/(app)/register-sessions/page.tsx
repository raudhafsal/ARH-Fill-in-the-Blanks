import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatMVR, formatMaldivesDateTime, cn } from "@/lib/utils";
import { formatDuration } from "@/lib/register";
import type { CashRegister } from "@/types/database";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;

export default async function RegisterSessionsPage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string };
}) {
  await requireRole(["administrator", "manager"]);
  const supabase = createClient();

  const page = Math.max(1, Number(searchParams.page) || 1);
  const status = searchParams.status === "open" || searchParams.status === "closed" ? searchParams.status : "all";

  let q = supabase.from("cash_registers").select("*", { count: "exact" }).order("session_no", { ascending: false });
  if (status !== "all") q = q.eq("status", status);
  const { data, count } = await q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const sessions = (data ?? []) as CashRegister[];

  const ids = Array.from(new Set(sessions.flatMap((s) => [s.cashier_id, s.closed_by]).filter(Boolean))) as string[];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    for (const p of profiles ?? []) names.set(p.id, p.full_name);
  }

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const href = (p: number, st = status) => `/register-sessions?${new URLSearchParams({ ...(st !== "all" ? { status: st } : {}), page: String(p) })}`;

  return (
    <div>
      <PageHeader title="Register sessions" description="Every cashier register, open or closed, with its cash reconciliation." />
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex gap-2">
          {(["all", "open", "closed"] as const).map((st) => (
            <Button key={st} asChild size="sm" variant={status === st ? "default" : "outline"}>
              <Link href={href(1, st)} className="capitalize">{st}</Link>
            </Button>
          ))}
        </div>
        <Card>
          <CardContent className="p-0 sm:p-0">
            {sessions.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No sessions found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No</TableHead>
                    <TableHead>Cashier</TableHead>
                    <TableHead>Opened</TableHead>
                    <TableHead>Closed</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="text-right">Cash difference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((s) => {
                    const diff = s.difference == null ? null : Number(s.difference);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">#{s.session_no}</TableCell>
                        <TableCell>{names.get(s.cashier_id) ?? "—"}</TableCell>
                        <TableCell>{formatMaldivesDateTime(s.opened_at)}</TableCell>
                        <TableCell>
                          {s.closed_at ? (
                            <>
                              {formatMaldivesDateTime(s.closed_at)}
                              {s.closed_by && s.closed_by !== s.cashier_id && (
                                <span className="block text-xs text-muted-foreground">by {names.get(s.closed_by) ?? "—"}</span>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>{formatDuration(s.opened_at, s.closed_at)}</TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            diff == null || Math.abs(diff) < 0.005 ? "text-muted-foreground" : diff < 0 ? "font-semibold text-destructive" : "font-semibold text-success"
                          )}
                        >
                          {diff == null ? "—" : formatMVR(diff)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={s.status === "open" ? "success" : "secondary"} className="capitalize">{s.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/register-sessions/${s.id}`}>Details</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && <Button asChild size="sm" variant="outline"><Link href={href(page - 1)}>Previous</Link></Button>}
              {page < totalPages && <Button asChild size="sm" variant="outline"><Link href={href(page + 1)}>Next</Link></Button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
