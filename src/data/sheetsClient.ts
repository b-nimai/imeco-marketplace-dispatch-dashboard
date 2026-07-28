// Google Sheets fetch layer for the dispatch dashboard.
//
// Ported from mission-control-dashboard/src/data/sheetsClient.js, which fanned out one
// request per tab. This dashboard needs 12 ranges, so the important change here is
// `batchGetValues()` — a single `values:batchGet` returns all of them in ONE HTTP request.
//
// Three mechanisms, cheapest first:
//   1. localStorage — a page reload inside the TTL renders from disk with ZERO network.
//   2. In-memory promise cache keyed by URL — de-dupes concurrent/duplicate callers.
//   3. Retry with exponential backoff + jitter on 429/5xx.

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined;
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// Matches the hourly poll in useDispatchData. Anything older is revalidated on boot.
export const TTL_MS = 60 * 60 * 1000;
const MAX_RETRIES = 4;
const LS_KEY = 'mdd:v1:payload';

type Rows = string[][];
export type RangeMap = Record<string, Rows>;

export interface CachedPayload {
  fetchedAt: number;
  ranges: RangeMap;
}

const cache = new Map<string, { t: number; p: Promise<unknown> }>();

async function sheetsFetch<T>(url: string, label: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res: Response | undefined;
    try {
      res = await fetch(url);
    } catch (e) {
      lastErr = e;
    }
    if (res) {
      if (res.ok) return (await res.json()) as T;
      // 4xx other than 429 are permanent (bad range, bad key) — don't retry.
      if (res.status !== 429 && res.status < 500) {
        throw new Error(`${label} ${res.status}`);
      }
      lastErr = new Error(`${label} ${res.status}`);
    }
    if (attempt < MAX_RETRIES) {
      const backoff = Math.min(8000, 600 * 2 ** attempt) + Math.random() * 400;
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`${label} failed`);
}

function cachedGet<T>(url: string, label: string): Promise<T> {
  const now = Date.now();
  const hit = cache.get(url);
  if (hit && now - hit.t < TTL_MS) return hit.p as Promise<T>;
  // Cache the promise immediately so concurrent callers share one request.
  const p = sheetsFetch<T>(url, label).catch((err) => {
    cache.delete(url); // don't cache failures — let the next call retry
    throw err;
  });
  cache.set(url, { t: now, p });
  return p;
}

/**
 * Fetch many ranges in a single HTTP request.
 *
 * Returns a map keyed by the *requested* range strings, in request order. We deliberately
 * do not key off `valueRanges[i].range` from the response — the API rewrites it (adds
 * quotes, expands `2:25` to `A2:VP25`), so echoing our own keys back is more stable.
 */
export async function batchGetValues(
  spreadsheetId: string | undefined,
  ranges: string[],
): Promise<RangeMap> {
  if (!API_KEY) throw new Error('VITE_GOOGLE_API_KEY not configured');
  if (!spreadsheetId) throw new Error('VITE_DISPATCH_SPREADSHEET_ID not configured');

  const qs = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
  const url = `${BASE}/${spreadsheetId}/values:batchGet?${qs}&majorDimension=ROWS&key=${API_KEY}`;

  const data = await cachedGet<{ valueRanges?: { values?: Rows }[] }>(url, 'Sheets batchGet');
  const out: RangeMap = {};
  ranges.forEach((range, i) => {
    out[range] = data.valueRanges?.[i]?.values ?? [];
  });
  return out;
}

/**
 * Every tab title in the workbook.
 *
 * The dashboard used to hardcode 11 tab names, which meant any channel without one silently
 * had no dated data — the reason `Other` could not be split by month. Discovering the titles
 * instead lets a new channel tab start reporting the moment someone adds it, with no code
 * change. `fields=` keeps the response to a few hundred bytes.
 */
export async function getSheetTitles(spreadsheetId: string | undefined): Promise<string[]> {
  if (!API_KEY) throw new Error('VITE_GOOGLE_API_KEY not configured');
  if (!spreadsheetId) throw new Error('VITE_DISPATCH_SPREADSHEET_ID not configured');

  const url = `${BASE}/${spreadsheetId}?fields=sheets.properties.title&key=${API_KEY}`;
  const data = await cachedGet<{ sheets?: { properties?: { title?: string } }[] }>(
    url,
    'Sheets metadata',
  );
  return (data.sheets ?? []).map((s) => s.properties?.title ?? '').filter(Boolean);
}

// ── localStorage ────────────────────────────────────────────────────────────────
// The sheet is edited a handful of times a day, so serving a reload from disk costs
// nothing in freshness and saves an API call every time someone opens the dashboard.

export function readCachedPayload(): CachedPayload | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPayload;
    if (!parsed?.ranges || typeof parsed.fetchedAt !== 'number') return null;
    return parsed;
  } catch {
    return null; // corrupt or quota-blocked storage is not an error worth surfacing
  }
}

export function writeCachedPayload(ranges: RangeMap): CachedPayload {
  const payload: CachedPayload = { fetchedAt: Date.now(), ranges };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch {
    // Over quota — the in-memory cache still covers this session.
  }
  return payload;
}

export function isStale(fetchedAt: number): boolean {
  return Date.now() - fetchedAt >= TTL_MS;
}

/**
 * Drop every cached copy so the next fetch goes to the network. Wired to the manual
 * refresh (logo click) so a just-edited sheet shows up immediately.
 */
export function clearSheetsCache(): void {
  cache.clear();
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}
