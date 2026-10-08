const MALDIVES_OFFSET_MINUTES = 5 * 60; // UTC+5, no DST

/** Start of "today" in Maldives time, returned as a UTC Date suitable for Postgres timestamptz comparisons. */
export function maldivesStartOfDay(daysAgo = 0): Date {
  const now = new Date();
  const mvNow = new Date(now.getTime() + MALDIVES_OFFSET_MINUTES * 60 * 1000);
  mvNow.setUTCHours(0, 0, 0, 0);
  mvNow.setUTCDate(mvNow.getUTCDate() - daysAgo);
  return new Date(mvNow.getTime() - MALDIVES_OFFSET_MINUTES * 60 * 1000);
}

export function maldivesEndOfDay(daysAgo = 0): Date {
  const start = maldivesStartOfDay(daysAgo);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function maldivesDayLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Indian/Maldives", weekday: "short", day: "2-digit" }).format(date);
}

/** Start of a calendar month in Maldives time (monthsAgo=0 is the current month), as a UTC Date. */
export function maldivesStartOfMonth(monthsAgo = 0): Date {
  const mvNow = new Date(Date.now() + MALDIVES_OFFSET_MINUTES * 60 * 1000);
  const firstUtc = Date.UTC(mvNow.getUTCFullYear(), mvNow.getUTCMonth() - monthsAgo, 1);
  return new Date(firstUtc - MALDIVES_OFFSET_MINUTES * 60 * 1000);
}
