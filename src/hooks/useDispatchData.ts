import { useCallback, useEffect, useRef, useState } from 'react';

import { ALL_RANGES, buildRanges, parseDispatchData, type DispatchData } from '@/data/parseSheet';
import {
  batchGetValues,
  clearSheetsCache,
  getSheetTitles,
  isStale,
  readCachedPayload,
  writeCachedPayload,
} from '@/data/sheetsClient';

// The sheet is edited a handful of times a day, so poll hourly. For an immediate update
// after an edit, use the manual refresh (logo click), which clears every cache layer.
const REFRESH_MS = 60 * 60 * 1000;
const MAX_FAILURES = 12; // ~12h of consecutive failures → reload the page

const SPREADSHEET_ID = import.meta.env.VITE_DISPATCH_SPREADSHEET_ID as string | undefined;

export interface UseDispatchData {
  data: DispatchData | null;
  fetchedAt: number | null;
  syncing: boolean;
  error: string | null;
  refresh: () => void;
}

/** Hydrate from localStorage synchronously so a reload paints instantly and costs 0 calls. */
function hydrate(): { data: DispatchData; fetchedAt: number } | null {
  const cached = readCachedPayload();
  if (!cached) return null;
  try {
    return { data: parseDispatchData(cached.ranges), fetchedAt: cached.fetchedAt };
  } catch {
    return null; // shape changed since it was written — refetch
  }
}

export function useDispatchData(): UseDispatchData {
  // Lazy state initialiser, not a ref: this runs exactly once and its value IS read during
  // render, which is precisely what refs must not be used for.
  const [initial] = useState(hydrate);

  const [data, setData] = useState<DispatchData | null>(initial?.data ?? null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(initial?.fetchedAt ?? null);
  const [syncing, setSyncing] = useState(!initial);
  const [error, setError] = useState<string | null>(null);

  const failureCount = useRef(0);
  const lastGood = useRef<DispatchData | null>(initial?.data ?? null);

  const load = useCallback(async () => {
    setSyncing(true);
    try {
      // Ask the workbook which tabs it has rather than assuming. This is what lets channels
      // outside the 6 marketplace groups — CRED, Shopify, Swiggy Instamart and the rest —
      // contribute dated units to `other` instead of being all-time-only. If the metadata
      // call fails we still render, just with the 6 groups' known tabs.
      let requested = ALL_RANGES;
      try {
        requested = buildRanges(await getSheetTitles(SPREADSHEET_ID));
      } catch (metaErr) {
        console.warn('[Dispatch] tab discovery failed, using known tabs', metaErr);
      }

      const ranges = await batchGetValues(SPREADSHEET_ID, requested);
      const parsed = parseDispatchData(ranges);
      const payload = writeCachedPayload(ranges);

      if (import.meta.env.DEV) {
        if (parsed.warnings.length) console.warn('[Dispatch] warnings', parsed.warnings);
        console.table(parsed.reconciliation);
      }

      lastGood.current = parsed;
      setData(parsed);
      setFetchedAt(payload.fetchedAt);
      setError(null);
      failureCount.current = 0;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Dispatch]', message);
      setError(message);
      failureCount.current += 1;
      if (failureCount.current >= MAX_FAILURES) window.location.reload();
      // Keep the last known good picture on screen rather than blanking the wall display.
      if (lastGood.current) setData(lastGood.current);
    } finally {
      setSyncing(false);
    }
  }, []);

  const refresh = useCallback(() => {
    clearSheetsCache();
    void load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => void load(), REFRESH_MS);

    // A fresh cache hit skips the boot fetch entirely — that's the 0-call reload.
    if (initial && !isStale(initial.fetchedAt)) return () => clearInterval(interval);

    // Deferred by a tick so the cached (or skeleton) paint lands before revalidation
    // starts, rather than the fetch's setState cascading onto the mount render.
    const boot = setTimeout(() => void load(), 0);
    return () => {
      clearTimeout(boot);
      clearInterval(interval);
    };
  }, [load, initial]);

  return { data, fetchedAt, syncing, error, refresh };
}
