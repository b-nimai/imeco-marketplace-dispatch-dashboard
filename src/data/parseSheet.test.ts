import { describe, expect, it } from 'vitest';

import fixture from './__fixtures__/outbound-tracker.json';
import { DRP_TAB, GROUPS } from './channels';
import { ALL_RANGES, buildRanges, dispatchRange, parseDispatchData } from './parseSheet';
import { PRODUCT_DISPLAY_NAMES } from './products';
import type { RangeMap } from './sheetsClient';

// A real batchGet snapshot of `Outbound Tracker`, taken 2026-07-27. Its job is to catch the
// parser silently losing a column — the failure mode that would make the timeline quietly
// under-count while still looking plausible.
const data = parseDispatchData(fixture as unknown as RangeMap);

describe('parseDispatchData', () => {
  it('reads all 23 SKUs, in Total Sold order-independent form', () => {
    expect(data.skus).toHaveLength(23);
    expect(data.skus[0].id).toBe('IMEFTCNP600');
    expect(data.heatmapRows).toHaveLength(23);
  });

  it('reconciles the dated tabs against the sheet-maintained all-time totals', () => {
    // THE load-bearing assertion. Both sides are computed independently: one by summing
    // parsed date columns, the other straight from Dashboard Ready Product.
    for (const r of data.reconciliation) {
      if (r.channel === 'other') continue; // covered separately below
      expect(`${r.channel}:${r.delta}`).toBe(`${r.channel}:0`);
    }
  });

  it('reports how much of `other` still has no dated tab behind it', () => {
    // This snapshot was taken before tab discovery existed, so it contains only the 11
    // marketplace tabs — every one of `other`'s 90,588 units is all-time-only here. Once the
    // workbook's CRED / Shopify / Instamart tabs are read, `fromTabs` rises and this delta
    // closes; it is the meter for how complete `other` is, not a pass/fail.
    const other = data.reconciliation.find((r) => r.channel === 'other')!;
    expect(other.allTime).toBe(90588);
    expect(other.fromTabs).toBe(0);
    expect(other.delta).toBe(-90588);
  });

  it('matches the known group totals', () => {
    expect(data.columnTotals).toMatchObject({
      blinkit: 317807,
      amazonB2B: 135802,
      flipkart: 95133,
      meesho: 24866,
      amazon: 14665,
      myntra: 10688,
    });
    expect(data.grandTotal).toBe(598961);
  });

  it('every heatmap row sums to that SKU Total Sold (so `other` closes the gap)', () => {
    for (const row of data.heatmapRows) {
      expect(`${row.sku.id}:${row.rowTotal}`).toBe(`${row.sku.id}:${row.sku.totalSold}`);
    }
  });

  it('attributes the 5 undated PO columns rather than dropping their 33,539 units', () => {
    expect(data.backfillNotes).toHaveLength(5);
    const tabs = [...new Set(data.backfillNotes.map((n) => n.tab))].sort();
    expect(tabs).toEqual(['BLINKIT', 'RK World']);

    const total = data.backfillNotes.reduce((s, n) => s + n.units, 0);
    expect(total).toBe(33539);
    // Every one landed on a real date.
    expect(data.backfillNotes.every((n) => n.attributedTo)).toBe(true);
  });

  it('produces sorted, de-duplicated dates', () => {
    const sorted = [...data.dates].sort();
    expect(data.dates).toEqual(sorted);
    expect(new Set(data.dates).size).toBe(data.dates.length);
    expect(data.dates[0]).toBe('2026-04-01');
  });

  it('excludes future-dated FBF columns from Last Dispatch', () => {
    // FBF carries planned dispatches out to 31-Jul; the KPI must not report those as shipped.
    expect(data.dates).toContain('2026-07-31');
    expect(data.lastDispatch).not.toBe('2026-07-31');
    expect(data.lastDispatch! <= new Date().toISOString().slice(0, 10)).toBe(true);
  });

  it('parses cleanly — no warnings against the real sheet', () => {
    expect(data.warnings).toEqual([]);
  });

  it('daily points carry every group key', () => {
    for (const point of data.daily) {
      for (const g of GROUPS) expect(point[g.key]).toBeTypeOf('number');
    }
  });
});

describe('heatmap scopes', () => {
  const months = data.scopes.filter((s) => s.key !== 'all');

  it('is all-time followed by every month, ascending', () => {
    expect(data.scopes[0].key).toBe('all');
    expect(months.map((s) => s.key)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07']);
    expect(months.map((s) => s.label)).toEqual(['Apr', 'May', 'Jun', 'Jul']);
  });

  it('loses nothing to month bucketing — the months sum to the 6-group total', () => {
    // THE load-bearing assertion for month tabs, and the mirror of the timeline
    // reconciliation above: rebuilding the grid per month from the dated columns must
    // recover every unit the all-time groups hold, backfilled columns included.
    const summed = months.reduce((s, m) => s + m.displayedTotal, 0);
    expect(summed).toBe(data.grandTotal);
    expect(summed).toBe(598961);
  });

  it('matches the known per-month totals', () => {
    // Dated columns alone give Apr 118,134 · May 151,674 · Jun 198,848 · Jul 96,766. The
    // remaining 33,539 units sit in the 5 undated PO columns and are attributed to their
    // nearest dated neighbour, which puts 11,951 in Jun and 21,588 in Jul.
    expect(Object.fromEntries(months.map((m) => [m.key, m.displayedTotal]))).toEqual({
      '2026-04': 118134,
      '2026-05': 151674,
      '2026-06': 210799,
      '2026-07': 118354,
    });
  });

  it('keeps every month grid aligned 1:1 with the SKU list', () => {
    for (const m of months) {
      expect(m.rows.map((r) => r.sku.id)).toEqual(data.skus.map((s) => s.id));
      expect(m.rows.every((r) => r.rowTotal === GROUPS.reduce((s, g) => s + r.cells[g.key], 0)));
    }
  });

  it('carries `other` on all time only — the months have no dated source for it', () => {
    const allTime = data.scopes[0];
    expect(allTime.hasOther).toBe(true);
    expect(allTime.rows).toBe(data.heatmapRows); // the sheet's own grid, not a re-derivation
    expect(allTime.displayedTotal).toBe(689549); // includes the 90,588 `other` units

    for (const m of months) {
      expect(m.hasOther).toBe(false);
      expect(m.rows.every((r) => r.cells.other === 0)).toBe(true);
    }
  });

  it('never reports a future-dated dispatch as the scope last dispatch', () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const s of data.scopes) {
      if (s.lastDispatch) expect(s.lastDispatch <= today).toBe(true);
    }
  });
});

describe('tab discovery', () => {
  it('requests every tab in the workbook except the rollup', () => {
    const ranges = buildRanges([DRP_TAB, 'BLINKIT', 'CRED', 'Swiggy Instamart']);
    expect(ranges).toEqual([
      ALL_RANGES[0],
      dispatchRange('BLINKIT'),
      dispatchRange('CRED'),
      dispatchRange('Swiggy Instamart'),
    ]);
  });

  it('falls back to the known marketplace tabs when the tab list is unavailable', () => {
    expect(buildRanges([])).toEqual(ALL_RANGES);
    expect(buildRanges([DRP_TAB])).toEqual(ALL_RANGES);
  });

  it('folds a discovered non-marketplace tab into `other`, month-wise', () => {
    // The whole point of discovery: a tab outside the 6 groups contributes dated units, so
    // `other` stops being an all-time-only bucket. Modelled on the real tab shape — row 2 is
    // the header, rows 3+ are the same SKUs in the same order, dates from column E.
    const skuRows = (fixture as unknown as RangeMap)[dispatchRange('BLINKIT')].slice(1);
    const cred = [
      ['SKU ID', 'Product Name', 'Product Name (V2)', 'Total', '05-Jun-2026', '06-Jul-2026'],
      ...skuRows.map((r, i) => [r[0], r[1], r[2], '', i === 0 ? '400' : '', i === 1 ? '250' : '']),
    ];

    const withCred = parseDispatchData({
      ...(fixture as unknown as RangeMap),
      [dispatchRange('CRED')]: cred,
    });

    const byKey = Object.fromEntries(withCred.scopes.map((s) => [s.key, s]));
    expect(byKey['2026-06'].columnTotals.other).toBe(400);
    expect(byKey['2026-07'].columnTotals.other).toBe(250);
    expect(byKey['2026-06'].hasOther).toBe(true);
    // April saw no CRED dispatch, so its `other` is a real zero, not an unknown.
    expect(byKey['2026-04'].columnTotals.other).toBe(0);
    expect(byKey['2026-04'].hasOther).toBe(false);

    // The units land on the right products, and roll into those products' month totals.
    expect(byKey['2026-06'].rows[0].cells.other).toBe(400);
    expect(byKey['2026-07'].rows[1].cells.other).toBe(250);

    // And they show up in the reconciliation meter rather than vanishing.
    const other = withCred.reconciliation.find((r) => r.channel === 'other')!;
    expect(other.fromTabs).toBe(650);
  });

  it('rejects a discovered tab that is not SKU-shaped rather than inventing units', () => {
    // A notes or summary sheet would otherwise be folded straight into `other`.
    const notes = [
      ['Heading', '', '', '', '01-Jun-2026'],
      ['some note', '', '', '', '9999'],
    ];
    const withNotes = parseDispatchData({
      ...(fixture as unknown as RangeMap),
      [dispatchRange('Notes')]: notes,
    });

    const other = withNotes.reconciliation.find((r) => r.channel === 'other')!;
    expect(other.fromTabs).toBe(0);
    expect(withNotes.grandTotal).toBe(data.grandTotal);
  });
});

describe('product display names', () => {
  it('covers every SKU in the sheet, and names nothing that is not in it', () => {
    // Guards both directions: a SKU added to the sheet would otherwise silently show its raw
    // 76-character name on the wall, and a re-keyed SKU would leave a dead override behind.
    const sheetIds = data.skus.map((s) => s.id).sort();
    expect(Object.keys(PRODUCT_DISPLAY_NAMES).sort()).toEqual(sheetIds);
  });

  it('uses the override for display and keeps the sheet name for hover', () => {
    const sku = data.skus.find((s) => s.id === 'IMEGHTTP6')!;
    expect(sku.name).toBe('Good Habbit Toilet Roll (160 pulls x 6)');
    expect(sku.sheetName).toBe(
      'IMECO GOOD HABIT 3 PLY 160 PULLS EACH TOILET PAPER ROLL (160X 6 - PACK OF 6)',
    );
  });
});
