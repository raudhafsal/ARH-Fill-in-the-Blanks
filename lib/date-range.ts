/** Shared date-range helpers for Reports / Staff pages. Dates are plain YYYY-MM-DD strings (Maldives-local business days). */

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayRange(): { from: string; to: string } {
  const now = new Date();
  const iso = toISODate(now);
  return { from: iso, to: iso };
}

export function thisWeekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  return { from: toISODate(monday), to: toISODate(now) };
}

export function thisMonthRange(): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toISODate(first), to: toISODate(now) };
}

/** Inclusive end-of-day ISO timestamp bound for filtering timestamptz columns by a plain date string. */
export function endOfDayIso(dateStr: string): string {
  return `${dateStr}T23:59:59.999`;
}

export function startOfDayIso(dateStr: string): string {
  return `${dateStr}T00:00:00.000`;
}
