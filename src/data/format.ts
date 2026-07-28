// Number/date formatting. ONE copy — mission-control has this duplicated across
// data/salesData.js and growth/format.js and they have already drifted apart.

/**
 * Sheet cell → number. Returns null (not 0) for genuinely absent values, so callers can
 * tell "no dispatch recorded" from "dispatched zero" — the discipline borrowed from
 * Accumulate_Price_Maker/lib/normalize.ts.
 */
export function parseNum(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  let s = String(raw).trim();
  if (!s) return null;
  if (s.toLowerCase() === 'nan') return null;
  s = s.replace(/[₹,\s]/g, '').replace(/[^0-9.-]/g, '');
  if (!s || s === '-' || s === '.') return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Same, but for summing — absent counts as 0. */
export function num(raw: unknown): number {
  return parseNum(raw) ?? 0;
}

const UNITS_FMT = new Intl.NumberFormat('en-IN');

/** 117087 → "1,17,087" (Indian grouping, matching the sheet's own locale). */
export function formatUnits(n: number): string {
  return UNITS_FMT.format(Math.round(n));
}

/** Axis/tile scale: 317807 → "3.2L", 9327 → "9.3K". */
export function formatShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${(n / 1e7).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (abs >= 1e5) return `${(n / 1e5).toFixed(1).replace(/\.0$/, '')}L`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(n));
}

export function formatPct(fraction: number): string {
  return `${(fraction * 100).toFixed(fraction < 0.01 && fraction > 0 ? 1 : 0)}%`;
}

const DAY_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** "2026-07-27" → "27 Jul". */
export function formatDay(iso: string): string {
  return DAY_FMT.format(new Date(`${iso}T00:00:00.000Z`));
}

const MONTH_FMT = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });

/** "2026-07" → "Jul", or "Jul '26" when the tab strip spans more than one year. */
export function formatMonth(monthKey: string, withYear = false): string {
  const label = MONTH_FMT.format(new Date(`${monthKey}-01T00:00:00.000Z`));
  return withYear ? `${label} '${monthKey.slice(2, 4)}` : label;
}

/** "2026-07" → "July 2026", for prose where the tab label would be too terse. */
export function formatMonthLong(monthKey: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${monthKey}-01T00:00:00.000Z`));
}

/** Relative freshness for the header: "synced 4m ago". */
export function formatAgo(ts: number, now = Date.now()): string {
  const secs = Math.max(0, Math.round((now - ts) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
