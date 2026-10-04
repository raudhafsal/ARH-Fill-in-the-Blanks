import type { RegisterSummaryRow } from "@/types/database";

/** Maldivian notes & coins (Rf) a cashier can count, smallest to largest like Ewity's calculator. */
export const DENOMINATIONS = [1, 2, 5, 10, 20, 50, 100, 500, 1000] as const;

export type Denominations = Record<string, number>;

export function denominationsTotal(d: Denominations | null | undefined): number {
  if (!d) return 0;
  let total = 0;
  for (const [value, count] of Object.entries(d)) {
    total += Number(value) * (Number(count) || 0);
  }
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

/** Drops zero/empty counts so we only store what was actually counted. Returns null if nothing was counted. */
export function cleanDenominations(d: Denominations): Denominations | null {
  const out: Denominations = {};
  for (const [value, count] of Object.entries(d)) {
    const n = Math.floor(Number(count) || 0);
    if (n > 0) out[value] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** The RPC returns numerics as strings/numbers depending on the driver — normalise them once. */
export function normalizeSummaryRows(rows: unknown): RegisterSummaryRow[] {
  return ((rows ?? []) as Record<string, unknown>[]).map((r) => ({
    payment_method_id: String(r.payment_method_id),
    method_name: String(r.method_name),
    method_code: String(r.method_code),
    method_order: Number(r.method_order),
    opening: Number(r.opening),
    received: Number(r.received),
    cash_in: Number(r.cash_in),
    cash_out: Number(r.cash_out),
    expected: Number(r.expected),
    is_cash: Boolean(r.is_cash),
    is_credit: Boolean(r.is_credit),
  }));
}

/** "2h 15m" style length of a session (open sessions count up to now). */
export function formatDuration(from: string, to: string | null): string {
  const ms = (to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime();
  const mins = Math.max(0, Math.round(ms / 60000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  return [d ? `${d}d` : "", h ? `${h}h` : "", `${m}m`].filter(Boolean).join(" ");
}
