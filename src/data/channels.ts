// The 6 marketplace groups, the sheet tabs behind each, and the colour each one wears.
//
// COLOUR ORDER IS NOT COSMETIC. These are categorical slots 1–6 of the validated
// data-viz palette, in their documented order, and the ordering IS the colourblind-safety
// mechanism. Verified against the dashboard's then-current chart surface (#0a1628):
//
//   node scripts/validate_palette.js "#3987e5,#d95926,#199e70,#c98500,#d55181,#008300" \
//        --mode dark --surface "#0a1628"
//   → ALL CHECKS PASS (worst adjacent CVD ΔE 8.4 protan, normal-vision ΔE 19.3, all ≥3:1)
//
// Two things have changed since, and neither invalidates the ordering — but know them:
//   • The timeline is gone, so nothing renders these as adjacent fills any more. The only
//     consumer left is the KPI "Top channel" accent, one line of bold text.
//   • The card surface moved from navy #0a1628 to teal #0c262b and then to a neutral #111111
//     on a black page — a lighter surface than the one validated against.
// Re-run the validator against the current surface before using these as fills again.
//
// Brand-matching the hues (Meesho magenta, Blinkit yellow…) was tried and FAILS: it puts
// magenta beside aqua, which collapses to ΔE 1.6 under deuteranopia. Do not reorder to
// chase brand colours — re-run the validator if you ever need to.

export type GroupKey = 'blinkit' | 'amazonB2B' | 'flipkart' | 'meesho' | 'amazon' | 'myntra';

/** How a group ships — drives whether we flag its lumpiness as intentional. */
export type Cadence = 'daily' | 'po' | 'mixed';

export interface Group {
  key: GroupKey;
  label: string;
  /** Sheet tabs merged into this group. */
  tabs: string[];
  /** Column headers in `Dashboard Ready Product` that roll up into this group. */
  drpColumns: string[];
  color: string;
  cadence: Cadence;
}

/**
 * Ordered by total volume descending, so the stack reads big-to-small bottom-up and the
 * palette slots land in their validated sequence.
 */
export const GROUPS: Group[] = [
  {
    key: 'blinkit',
    label: 'Blinkit',
    tabs: ['BLINKIT'],
    drpColumns: ['BLINKIT'],
    color: '#3987e5',
    cadence: 'daily',
  },
  {
    key: 'amazonB2B',
    label: 'Amazon B2B',
    tabs: ['RK World', 'CLICKTECH P.O.'],
    drpColumns: ['RK World', 'CLICKTECH P.O.'],
    color: '#d95926',
    cadence: 'po',
  },
  {
    key: 'flipkart',
    label: 'Flipkart',
    tabs: ['FLIPKART', 'FBF'],
    drpColumns: ['Flipkart', 'FBF'],
    color: '#199e70',
    cadence: 'daily',
  },
  {
    key: 'meesho',
    label: 'Meesho',
    tabs: ['Meesho', 'MEESHO PO'],
    drpColumns: ['Meesho', 'Meesho PO'],
    color: '#c98500',
    cadence: 'mixed',
  },
  {
    key: 'amazon',
    label: 'Amazon',
    tabs: ['AMAZON', 'AMAZON FLEX'],
    drpColumns: ['Amazon', 'AMAZON FLEX'],
    color: '#d55181',
    cadence: 'daily',
  },
  {
    key: 'myntra',
    label: 'Myntra',
    tabs: ['Myntra', 'MYNTRA PO'],
    drpColumns: ['Myntra', 'MYNTRA PO'],
    color: '#008300',
    cadence: 'mixed',
  },
];

/** The catch-all heatmap column. Not a categorical slot — it wears muted ink. */
export const OTHER_KEY = 'other' as const;
export type HeatmapColumnKey = GroupKey | typeof OTHER_KEY;

export const OTHER_LABEL = 'Other';

export const DRP_TAB = 'Dashboard Ready Product';

/** Every tab we read, in batchGet order. */
export const DISPATCH_TABS: string[] = GROUPS.flatMap((g) => g.tabs);

/** Normalise a sheet header for matching: collapse whitespace/newlines, uppercase. */
export function normaliseChannel(raw: string): string {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

const TAB_TO_GROUP = new Map<string, GroupKey>();
for (const g of GROUPS) for (const t of g.tabs) TAB_TO_GROUP.set(normaliseChannel(t), g.key);

const DRP_COLUMN_TO_GROUP = new Map<string, GroupKey>();
for (const g of GROUPS) {
  for (const c of g.drpColumns) DRP_COLUMN_TO_GROUP.set(normaliseChannel(c), g.key);
}

export function groupForTab(tab: string): GroupKey | undefined {
  return TAB_TO_GROUP.get(normaliseChannel(tab));
}

/**
 * Map a dispatch tab to a heatmap column. Anything outside the 6 marketplace groups — CRED,
 * Shopify, Swiggy Instamart, First Club and the rest — folds into `other`, exactly as its
 * `Dashboard Ready Product` column does. That symmetry is what lets `other` be split by month
 * instead of being an all-time-only bucket.
 */
export function heatmapColumnForTab(tab: string): HeatmapColumnKey {
  return TAB_TO_GROUP.get(normaliseChannel(tab)) ?? OTHER_KEY;
}

/**
 * Map a `Dashboard Ready Product` channel column to a heatmap column. Anything not claimed
 * by one of the 6 groups folds into `other`, so every SKU row still sums to its Total Sold.
 */
export function heatmapColumnForDrpHeader(header: string): HeatmapColumnKey {
  return DRP_COLUMN_TO_GROUP.get(normaliseChannel(header)) ?? OTHER_KEY;
}

export const GROUP_BY_KEY: Record<GroupKey, Group> = Object.fromEntries(
  GROUPS.map((g) => [g.key, g]),
) as Record<GroupKey, Group>;
