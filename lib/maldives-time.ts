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
