// batchGet response → everything the heatmap renders.
//
// Two independent paths, deliberately:
//   • The all-time scope comes straight from `Dashboard Ready Product`, which the sheet
//     maintains itself. No aggregation, so no drift.
//   • The month scopes and the daily series are aggregated from the 11 dispatch tabs.
// `reconciliation` compares the two. They must match exactly; a mismatch means the column
// parser dropped something.

import {
  DISPATCH_TABS,
  DRP_TAB,
  GROUPS,
  GROUP_BY_KEY,
  OTHER_KEY,
  groupForTab,
  heatmapColumnForDrpHeader,
  heatmapColumnForTab,
  type GroupKey,
  type HeatmapColumnKey,
} from './channels';
import { formatMonth, num, parseNum } from './format';
import { parseDispatchDate, toIsoKey } from './parseDate';
import { displayName } from './products';
import type { RangeMap } from './sheetsClient';

/** Rows 3–25 in every tab. Requested as `2:25` so row 2 (the header) lands at index 0. */
export const HEADER_ROW_OFFSET = 0;
export const FIRST_DATA_ROW = 1;
/** Cols A–D are SKU ID / Name / Name (V2) / Total. Data starts at E. */
export const FIRST_VALUE_COL = 4;

export const DRP_RANGE = `'${DRP_TAB}'!A2:AC25`;

export function dispatchRange(tab: string): string {
  return `'${tab}'!2:25`;
}

/** Recovers the tab name from a dispatch range key, so the parser can work off whatever
 *  ranges it was actually handed rather than a hardcoded list. */
const DISPATCH_RANGE_RE = /^'(.+)'!2:25$/;

export const DISPATCH_RANGES = DISPATCH_TABS.map(dispatchRange);
/** Fallback when the workbook's tab list is unavailable: the 6 groups' known tabs only. */
export const ALL_RANGES = [DRP_RANGE, ...DISPATCH_RANGES];

/**
 * Ranges to request, given every tab title in the workbook.
 *
 * Every tab except the rollup is read. Tabs outside the 6 marketplace groups fold into
 * `other`, and anything that turns out not to be a per-SKU dispatch tab is rejected during
 * parsing by the SKU-alignment check rather than being guessed at here.
 */
export function buildRanges(tabTitles: string[]): string[] {
  const tabs = tabTitles.filter((t) => t.trim() && t !== DRP_TAB);
  if (!tabs.length) return ALL_RANGES;
  return [DRP_RANGE, ...tabs.map(dispatchRange)];
}

export interface Sku {
  id: string;
  /** Wall-display name — the short override where one exists, else `sheetName`. */
  name: string;
  /** Verbatim `Product Name` from the sheet, so hover can always recover the real identity. */
  sheetName: string;
  totalSold: number;
}

export interface HeatmapRow {
  sku: Sku;
  cells: Record<HeatmapColumnKey, number>;
  /** Sum of cells — equals sku.totalSold when the sheet is self-consistent. */
  rowTotal: number;
}

/** `all` plus one entry per calendar month, in that order. */
export const ALL_SCOPE_KEY = 'all';

/**
 * One tab's worth of heatmap: the grid, its totals, and the freshness facts that describe it.
 *
 * The all-time scope is the sheet's own `Dashboard Ready Product` grid, so it carries the
 * `other` bucket (14 non-marketplace channels — CRED, Shopify, Swiggy…). Month scopes are
 * rebuilt from the dated dispatch tabs, which have no `other` source at all, so their `other`
 * column is structurally empty and `hasOther` is false. That is why the month totals do not
 * sum to the all-time total: the difference is exactly `other`.
 */
export interface HeatmapScope {
  /** `all`, or a `YYYY-MM` month key. */
  key: string;
  /** Tab label: `All time`, or `Jul` / `Jul '26` when the data spans more than one year. */
  label: string;
  /** Same SKU order as `skus` — callers do the sorting they want. */
  rows: HeatmapRow[];
  columnTotals: Record<HeatmapColumnKey, number>;
  /** Sum of every cell this scope actually shows. Includes `other` only when `hasOther`. */
  displayedTotal: number;
  hasOther: boolean;
  /** Latest dispatch date in scope that is not in the future. */
  lastDispatch: string | null;
  dispatchDays: number;
}

/** One column whose header carried no date, and where its units were placed. */
export interface BackfillNote {
  tab: string;
  channel: HeatmapColumnKey;
  header: string;
  units: number;
  attributedTo: string | null;
}

export type DailyPoint = { date: string } & Partial<Record<GroupKey, number>>;

/**
 * Per-channel cross-check: units summed from the dated tabs vs the sheet's own all-time
 * rollup. They must match exactly; a mismatch means the column parser dropped something.
 */
export interface Reconciliation {
  channel: HeatmapColumnKey;
  fromTabs: number;
  allTime: number;
  delta: number;
}

export interface DispatchData {
  skus: Sku[];
  /** Sorted ISO date keys with at least one unit dispatched. */
  dates: string[];
  daily: DailyPoint[];
  /** Units attributed from undated columns, keyed `${iso}|${group}`. */
  backfillByPoint: Record<string, number>;
  backfillNotes: BackfillNote[];
  heatmapRows: HeatmapRow[];
  columnTotals: Record<HeatmapColumnKey, number>;
  /** Units summed from the dated tabs, per channel — the independent side of `reconciliation`. */
  channelTabTotals: Record<HeatmapColumnKey, number>;
  /** All-time units across the 6 marketplace groups only — the reconciliation baseline. */
  grandTotal: number;
  lastDispatch: string | null;
  reconciliation: Reconciliation[];
  /** `[allTime, ...months ascending]` — one per heatmap tab. */
  scopes: HeatmapScope[];
  warnings: string[];
}

interface ColumnSpec {
  index: number;
  header: string;
  /** Resolved from the header, or inherited from a neighbour when the header had no date. */
  iso: string | null;
  dated: boolean;
}

/**
 * Resolve every value column to a date.
 *
 * Undated columns inherit the nearest dated column to their LEFT (columns run roughly
 * chronologically, so the left neighbour is the preceding dispatch). A leading undated
 * column instead borrows from the first dated column to its right.
 */
function resolveColumns(header: string[]): ColumnSpec[] {
  const specs: ColumnSpec[] = [];
  for (let c = FIRST_VALUE_COL; c < header.length; c++) {
    const raw = header[c] ?? '';
    if (!String(raw).trim()) continue;
    const d = parseDispatchDate(raw);
    specs.push({ index: c, header: String(raw), iso: d ? toIsoKey(d) : null, dated: !!d });
  }

  let lastSeen: string | null = null;
  for (const s of specs) {
    if (s.dated) lastSeen = s.iso;
    else s.iso = lastSeen;
  }
  // Leading undated columns had nothing to their left — take the first date to the right.
  let nextSeen: string | null = null;
  for (let i = specs.length - 1; i >= 0; i--) {
    if (specs[i].dated) nextSeen = specs[i].iso;
    else if (specs[i].iso === null) specs[i].iso = nextSeen;
  }
  return specs;
}

function emptyColumnTotals(): Record<HeatmapColumnKey, number> {
  const out = { [OTHER_KEY]: 0 } as Record<HeatmapColumnKey, number>;
  for (const g of GROUPS) out[g.key] = 0;
  return out;
}

function parseHeatmap(rows: string[][], warnings: string[]) {
  const header = rows[HEADER_ROW_OFFSET] ?? [];
  const columnKeys: HeatmapColumnKey[] = [];
  for (let c = FIRST_VALUE_COL; c < header.length; c++) {
    columnKeys[c] = heatmapColumnForDrpHeader(header[c] ?? '');
  }

  const skus: Sku[] = [];
  const heatmapRows: HeatmapRow[] = [];
  const columnTotals = emptyColumnTotals();

  for (let r = FIRST_DATA_ROW; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const id = String(row[0] ?? '').trim();
    if (!id) continue;

    const sheetName = String(row[1] ?? '').trim() || id;
    const sku: Sku = {
      id,
      name: displayName(id, sheetName),
      sheetName,
      totalSold: num(row[3]),
    };
    const cells = emptyColumnTotals();
    let rowTotal = 0;

    for (let c = FIRST_VALUE_COL; c < header.length; c++) {
      const key = columnKeys[c];
      if (!key) continue;
      const v = num(row[c]);
      cells[key] += v;
      rowTotal += v;
      columnTotals[key] += v;
    }

    if (rowTotal !== sku.totalSold) {
      warnings.push(
        `${DRP_TAB}: ${id} channel columns sum to ${rowTotal} but Total Sold reads ${sku.totalSold}`,
      );
    }

    skus.push(sku);
    heatmapRows.push({ sku, cells, rowTotal });
  }

  return { skus, heatmapRows, columnTotals };
}

interface ScopeInput {
  skus: Sku[];
  heatmapRows: HeatmapRow[];
  columnTotals: Record<HeatmapColumnKey, number>;
  byMonth: Map<string, Map<string, Record<HeatmapColumnKey, number>>>;
  dates: string[];
  lastDispatch: string | null;
  todayIso: string;
}

const ALL_COLUMN_KEYS: HeatmapColumnKey[] = [...GROUPS.map((g) => g.key), OTHER_KEY];

/**
 * `[allTime, ...months ascending]`.
 *
 * The all-time scope hands back the DRP grid by reference — it is the sheet's own answer and
 * re-deriving it would only invite drift. Month scopes are built from the dated tabs, and
 * cover every channel that has one, `other` included.
 */
function buildScopes({
  skus,
  heatmapRows,
  columnTotals,
  byMonth,
  dates,
  lastDispatch,
  todayIso,
}: ScopeInput): HeatmapScope[] {
  const monthKeys = [...byMonth.keys()].sort();
  // Only disambiguate when it earns its width — "Jul" until the data crosses a year boundary.
  const multiYear = new Set(monthKeys.map((m) => m.slice(0, 4))).size > 1;

  const allTime: HeatmapScope = {
    key: ALL_SCOPE_KEY,
    label: 'All time',
    rows: heatmapRows,
    columnTotals,
    displayedTotal: heatmapRows.reduce((s, r) => s + r.rowTotal, 0),
    hasOther: true,
    lastDispatch,
    dispatchDays: dates.length,
  };

  const months = monthKeys.map((key): HeatmapScope => {
    const bySku = byMonth.get(key)!;
    const scopeTotals = emptyColumnTotals();
    const rows = skus.map((sku): HeatmapRow => {
      const cells = bySku.get(sku.id) ?? emptyColumnTotals();
      let rowTotal = 0;
      for (const k of ALL_COLUMN_KEYS) {
        rowTotal += cells[k];
        scopeTotals[k] += cells[k];
      }
      return { sku, cells, rowTotal };
    });

    const monthDates = dates.filter((d) => d.startsWith(key));
    return {
      key,
      label: formatMonth(key, multiYear),
      rows,
      columnTotals: scopeTotals,
      displayedTotal: ALL_COLUMN_KEYS.reduce((s, k) => s + scopeTotals[k], 0),
      // Only false when the workbook has no dated tab for any `other` channel — then the
      // column is genuinely unanswerable for this month rather than merely zero.
      hasOther: scopeTotals[OTHER_KEY] > 0,
      lastDispatch: [...monthDates].reverse().find((d) => d <= todayIso) ?? null,
      dispatchDays: monthDates.length,
    };
  });

  return [allTime, ...months];
}

export function parseDispatchData(ranges: RangeMap): DispatchData {
  const warnings: string[] = [];

  const drpRows = ranges[DRP_RANGE] ?? [];
  if (!drpRows.length) throw new Error(`No data returned for "${DRP_TAB}"`);
  const { skus, heatmapRows, columnTotals } = parseHeatmap(drpRows, warnings);
  const expectedSkuIds = skus.map((s) => s.id).join('|');

  // date -> channel -> units
  const byDate = new Map<string, Map<HeatmapColumnKey, number>>();
  // month -> skuId -> channel -> units. This is the month heatmap; it needs the per-SKU value
  // that a whole-column sum throws away.
  const byMonth = new Map<string, Map<string, Record<HeatmapColumnKey, number>>>();
  const backfillByPoint: Record<string, number> = {};
  const backfillNotes: BackfillNote[] = [];
  const channelTabTotals = emptyColumnTotals();

  // Whatever dispatch ranges we were handed — discovered from the workbook when the tab list
  // was available, the 6 groups' known tabs otherwise.
  const dispatchTabs = Object.keys(ranges)
    .map((key) => DISPATCH_RANGE_RE.exec(key)?.[1])
    .filter((tab): tab is string => !!tab);

  for (const tab of dispatchTabs) {
    const rows = ranges[dispatchRange(tab)] ?? [];
    const group = groupForTab(tab);
    if (!rows.length) {
      // Only worth flagging for a tab we expect to carry dispatch data. A discovered tab that
      // turns out to be empty is just a tab.
      if (group) warnings.push(`No data returned for tab "${tab}"`);
      continue;
    }
    const channel = heatmapColumnForTab(tab);

    // A whole-column sum can't be corrupted by SKU order — but a drift here would mean the
    // sheet's shape changed, which the per-SKU grid DOES depend on.
    const tabSkuIds = rows
      .slice(FIRST_DATA_ROW)
      .map((r) => String(r?.[0] ?? '').trim())
      .filter(Boolean)
      .join('|');
    if (tabSkuIds !== expectedSkuIds) {
      if (group) {
        // A known marketplace tab must never drift; surface it and carry on.
        warnings.push(`Tab "${tab}" SKU rows differ from ${DRP_TAB} — check row alignment`);
      } else {
        // A discovered tab that is not SKU-shaped is not a dispatch tab at all — a summary or
        // notes sheet. Folding it into `other` would silently invent units.
        continue;
      }
    }

    const header = rows[HEADER_ROW_OFFSET] ?? [];
    for (const spec of resolveColumns(header)) {
      let colSum = 0;
      // Kept alongside colSum so the month grid and the timeline can never disagree — they
      // are two reductions of the same single read.
      const perSku: { id: string; units: number }[] = [];
      for (let r = FIRST_DATA_ROW; r < rows.length; r++) {
        const units = parseNum(rows[r]?.[spec.index]) ?? 0;
        if (!units) continue;
        colSum += units;
        const id = String(rows[r]?.[0] ?? '').trim();
        // A value on a row with no SKU ID still counts toward the tab total, but there is
        // nothing to attribute it to. The row-alignment check above already warned.
        if (id) perSku.push({ id, units });
      }
      if (!spec.iso) {
        if (colSum > 0) {
          warnings.push(
            `Tab "${tab}": column "${spec.header.replace(/\s+/g, ' ').trim()}" has ${colSum} units and no date anywhere to attribute to — dropped`,
          );
        }
        continue;
      }

      let slot = byDate.get(spec.iso);
      if (!slot) byDate.set(spec.iso, (slot = new Map()));
      slot.set(channel, (slot.get(channel) ?? 0) + colSum);
      channelTabTotals[channel] += colSum;

      // Undated columns inherited a neighbour's date above, so their units land in a month
      // here for free — the same attribution the daily series already makes.
      const monthKey = spec.iso.slice(0, 7);
      let bySku = byMonth.get(monthKey);
      if (!bySku) byMonth.set(monthKey, (bySku = new Map()));
      for (const { id, units } of perSku) {
        let cells = bySku.get(id);
        if (!cells) bySku.set(id, (cells = emptyColumnTotals()));
        cells[channel] += units;
      }

      if (!spec.dated) {
        const pointKey = `${spec.iso}|${channel}`;
        backfillByPoint[pointKey] = (backfillByPoint[pointKey] ?? 0) + colSum;
        backfillNotes.push({
          tab,
          channel,
          header: spec.header.replace(/\s+/g, ' ').trim(),
          units: colSum,
          attributedTo: spec.iso,
        });
      }
    }
  }

  const dates = [...byDate.keys()].sort();
  const daily: DailyPoint[] = dates.map((date) => {
    const point: DailyPoint = { date };
    const slot = byDate.get(date)!;
    for (const g of GROUPS) point[g.key] = slot.get(g.key) ?? 0;
    return point;
  });

  const todayIso = toIsoKey(new Date());
  // FBF carries future-dated planned dispatches; "last dispatch" must not report those.
  const lastDispatch = [...dates].reverse().find((d) => d <= todayIso) ?? null;

  const reconciliation: Reconciliation[] = GROUPS.map((g) => {
    const fromTabs = channelTabTotals[g.key];
    const allTime = columnTotals[g.key];
    return { channel: g.key as HeatmapColumnKey, fromTabs, allTime, delta: fromTabs - allTime };
  });

  for (const r of reconciliation) {
    if (r.delta !== 0) {
      warnings.push(
        `${GROUP_BY_KEY[r.channel as GroupKey].label}: tabs ${r.fromTabs} vs all-time ${r.allTime} (Δ ${r.delta})`,
      );
    }
  }

  // `other` reconciles only once every non-marketplace channel has a dated tab. Until then the
  // shortfall is expected, so it is reported rather than warned — it is the number that tells
  // you how much of `other` is still all-time-only.
  const otherFromTabs = channelTabTotals[OTHER_KEY];
  const otherAllTime = columnTotals[OTHER_KEY];
  reconciliation.push({
    channel: OTHER_KEY,
    fromTabs: otherFromTabs,
    allTime: otherAllTime,
    delta: otherFromTabs - otherAllTime,
  });

  const grandTotal = GROUPS.reduce((s, g) => s + columnTotals[g.key], 0);
  const scopes = buildScopes({
    skus,
    heatmapRows,
    columnTotals,
    byMonth,
    dates,
    lastDispatch,
    todayIso,
  });

  return {
    skus,
    dates,
    daily,
    backfillByPoint,
    backfillNotes,
    heatmapRows,
    columnTotals,
    channelTabTotals,
    grandTotal,
    lastDispatch,
    reconciliation,
    scopes,
    warnings,
  };
}
