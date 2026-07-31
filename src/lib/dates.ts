// All date logic runs at build time, in IST (Asia/Kolkata, UTC+5:30).
// Convention: a "day" is represented as UTC midnight of that calendar day,
// which is exactly what zod's z.coerce.date() produces for YYYY-MM-DD
// frontmatter strings. todayIST() maps the build instant onto the same
// representation so all comparisons are plain UTC-midnight math.

const IST_OFFSET_MIN = 330;
const DAY_MS = 86_400_000;
const FALLBACK_WINDOW_DAYS = 14;

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** UTC midnight of the current IST calendar day. */
export function todayIST(now: Date = new Date()): Date {
  const shifted = now.getTime() + IST_OFFSET_MIN * 60_000;
  return new Date(Math.floor(shifted / DAY_MS) * DAY_MS);
}

/**
 * Percent of the assignment window already elapsed, as a 0-100 integer.
 * Without an explicit start, the window is the 14 days before due.
 */
export function burnPercent(due: Date, start: Date | undefined, today: Date): number {
  const windowStart = start ?? new Date(due.getTime() - FALLBACK_WINDOW_DAYS * DAY_MS);
  const total = due.getTime() - windowStart.getTime();
  if (total <= 0) return 100;
  const elapsed = today.getTime() - windowStart.getTime();
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

export function isOverdue(due: Date, today: Date): boolean {
  return due.getTime() < today.getTime();
}

/** Due within the next `windowDays` IST days, or already overdue. */
export function isDueSoon(due: Date, today: Date, windowDays = 7): boolean {
  return isOverdue(due, today) || daysLeft(due, today) <= windowDays;
}

/** Whole days until due; negative once overdue. */
export function daysLeft(due: Date, today: Date): number {
  return Math.round((due.getTime() - today.getTime()) / DAY_MS);
}

/** "04 Aug 2026" */
export function fmt(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${day} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "04 AUG 2026", for the per-page log stamp. */
export function stamp(d: Date): string {
  return fmt(d).toUpperCase();
}
