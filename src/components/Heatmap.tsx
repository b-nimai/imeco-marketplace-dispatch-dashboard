import { type CSSProperties, useMemo } from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { GROUPS, OTHER_KEY, OTHER_LABEL, type HeatmapColumnKey } from '@/data/channels';
import { formatPct, formatShort, formatUnits } from '@/data/format';
import type { HeatmapRow, HeatmapScope } from '@/data/parseSheet';
import { useGridFit } from '@/hooks/useGridFit';
import { INK, domain, fill, position } from '@/lib/heatmapScale';
import { cn } from '@/lib/utils';

const COLUMNS: { key: HeatmapColumnKey; label: string; muted?: boolean }[] = [
  ...GROUPS.map((g) => ({ key: g.key as HeatmapColumnKey, label: g.label })),
  { key: OTHER_KEY, label: OTHER_LABEL, muted: true },
];

const GROUP_KEYS = GROUPS.map((g) => g.key as HeatmapColumnKey);
const ALL_KEYS = COLUMNS.map((c) => c.key);

/** Shared cell chrome, so no two cells can drift apart on how a value is drawn. */
function shadedCell(value: number, sorted: number[]) {
  if (value <= 0) {
    return {
      className: 'text-muted-foreground/60',
      // A hairline keeps the grid legible where there is no fill to carry it.
      style: { boxShadow: 'inset 0 0 0 1px var(--border)' } as const,
      text: '·',
    };
  }
  return {
    className: '',
    style: { backgroundColor: fill(position(value, sorted)), color: INK },
    text: formatShort(value),
  };
}

/**
 * The two pinned columns are sized from `--name-w` / `--total-w`, both computed in the
 * component. Read the note there before changing these — the widths are a `min()` of a type
 * multiple AND a share of the viewport, and the second half is what stops the grid breaking.
 *
 * Below `lg` it all collapses to a fixed 10rem: on a phone a proportional column would be the
 * entire viewport and leave no room at all for the data, so names fall back to their
 * `truncate` + tooltip. The switch is at `lg`, not `md`, because on a tablet the wide column
 * would leave the channels nothing.
 */
const NAME_W =
  'w-[10rem] min-w-[10rem] max-w-[10rem] lg:w-[var(--name-w)] lg:min-w-[var(--name-w)] lg:max-w-[var(--name-w)]';
const TOTAL_W =
  'w-[5.5rem] min-w-[5.5rem] lg:w-[var(--total-w)] lg:min-w-[var(--total-w)]';
/** Sticky offset for the Total column = the name column plus one border-spacing step. */
const TOTAL_LEFT = 'left-[10.25rem] lg:left-[calc(var(--name-w)+2px)]';

/**
 * Every type size in the grid is a multiple of `--grid-font`, the px value `useGridFit`
 * measures for the box the card was given — see src/lib/gridFit.ts for why it is measured
 * rather than fixed. The ratios are what used to be 11/12/13px, kept in proportion.
 *
 * The explicit `leading` is load-bearing, not tidiness: `Table` carries `text-sm`, whose
 * 20px line-height would otherwise pin every line box regardless of the font size, so the
 * rows would not shrink or grow with the type and the fit would be computed against a height
 * the grid does not really occupy. gridFit.ts hardcodes this 1.15 — change both together.
 *
 * HEAD_H and TOTALS_TOP must stay identical: the totals row is welded under the header by a
 * sticky offset equal to the header's height, and they were both a hardcoded 28px before
 * this. If they drift, the totals row floats or slides underneath as the grid scrolls.
 */
const CELL_TEXT = 'text-[length:var(--grid-font)] leading-[1.15]';
const HEAD_TEXT = 'text-[length:calc(var(--grid-font)*0.9)]';
const TOTALS_TEXT = 'text-[length:calc(var(--grid-font)*1.1)] leading-[1.15]';
const HEAD_H = 'h-[calc(var(--grid-font)*2)]';
const TOTALS_TOP = 'top-[calc(var(--grid-font)*2)]';

interface Props {
  scope: HeatmapScope;
  /** Already sorted and filtered by the view — the grid renders what it is given. */
  rows: HeatmapRow[];
}

export function Heatmap({ scope, rows }: Props) {
  // When the workbook has no dated tab behind any `other` channel, that column is
  // unanswerable for this month rather than merely zero — leave it out of the row statistics
  // so it cannot drag the colour scale toward zero.
  const shadedKeys = scope.hasOther ? ALL_KEYS : GROUP_KEYS;

  // The scale's domain is every filled cell on screen, so the same number is the same colour
  // wherever it appears. Built from the rows actually rendered: hiding the empty products or
  // switching month changes what "large" means, and the colours should follow.
  const sorted = useMemo(
    () => domain(rows.flatMap((row) => shadedKeys.map((k) => row.cells[k]))),
    [rows, shadedKeys],
  );

  // The type is sized to the box, not fixed: with every product on screen and nobody at the
  // TV to scroll, the grid has to be as large as it can be while still fitting.
  const [fitRef, fontPx] = useGridFit(rows.length);

  return (
    // The height has to land on the table's own container — that div carries `overflow-x-auto`,
    // which makes it the scrollport, and sticky rows/columns only stick inside a scrollport
    // that is actually bounded.
    <div
      ref={fitRef}
      className="h-full min-h-0 [&>[data-slot=table-container]]:h-full"
      // The pinned columns want to scale with the type — a 47-char name needs 23.7x the font
      // size, so 25x fits it without an ellipsis. But the type is measured from the grid's
      // HEIGHT and a column is spent out of its WIDTH, and those two are independent: on a
      // screen that is tall relative to its width (a 4K panel, a portrait-ish window) 25x the
      // font is most of the viewport, the seven channel columns collapse, and the table blows
      // straight through its container.
      //
      // So each is a `min()` of the two axes. The type multiple keeps names intact at normal
      // aspect ratios; the vw share is the guarantee — the two pinned columns can never take
      // more than a third of the screen, which leaves the channels the other two thirds no
      // matter what the fit function returns.
      style={
        {
          '--grid-font': `${fontPx}px`,
          '--name-w': `min(${fontPx * 25}px, 26vw)`,
          '--total-w': `min(${fontPx * 6}px, 7vw)`,
        } as CSSProperties
      }
    >
      {/* `h-full` fills a wall display: rows are compact by nature, and the browser hands the
          leftover height back to them rather than leaving a band of empty card at the bottom.
          On a short viewport they keep their natural height and the container scrolls instead.

          `table-fixed` is what makes every channel column the SAME width. Under auto layout
          they size to their header text, so AMAZON B2B came out half again as wide as MEESHO
          and the cells stopped being comparable at a glance. Fixed layout takes widths from
          the header row only: Product and Total are pinned below, and the 7 channels split
          what is left evenly. */}
      {/* `min-w` is what makes this usable on a phone. Under `table-fixed` + `w-full` the
          channel columns divide up whatever is left after the two pinned ones, which on a
          narrow screen is nothing — they collapsed to zero width and the grid showed only
          product names. A floor on the table width makes the container scroll horizontally
          instead, with Product and Total pinned. It is inert on a desktop, where the table
          is already far wider than this. */}
      <Table className="h-full table-fixed border-separate border-spacing-0.5 min-w-[47rem]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead
              className={cn(
                'eyebrow sticky top-0 left-0 z-30 bg-card text-left',
                HEAD_TEXT,
                HEAD_H,
                NAME_W,
              )}
            >
              Product
            </TableHead>
            <TableHead
              className={cn(
                'eyebrow sticky top-0 z-30 bg-card text-right',
                HEAD_TEXT,
                HEAD_H,
                TOTAL_LEFT,
                TOTAL_W,
              )}
            >
              Total
            </TableHead>
            {COLUMNS.map((c) => (
              <TableHead
                key={c.key}
                className={cn(
                  'eyebrow sticky top-0 z-20 bg-card text-center whitespace-nowrap',
                  HEAD_TEXT,
                  HEAD_H,
                  c.muted && 'opacity-50',
                )}
              >
                {c.label}
              </TableHead>
            ))}
          </TableRow>

          {/* Channel totals. The underline is load-bearing: without it this row reads as just
              another product and the totals look missing. */}
          <TableRow className="hover:bg-transparent">
            <TableCell
              className={cn(
                'eyebrow sticky left-0 z-30 border-b-2 border-primary/40 bg-card py-1.5 text-foreground',
                HEAD_TEXT,
                TOTALS_TOP,
                NAME_W,
              )}
            >
              All channels
            </TableCell>
            <TableCell
              className={cn(
                'sticky z-30 border-b-2 border-primary/40 bg-card py-1.5 text-right font-mono font-bold tabular-nums text-foreground',
                TOTALS_TEXT,
                TOTALS_TOP,
                TOTAL_LEFT,
                TOTAL_W,
              )}
              title={`${scope.label}: ${formatUnits(scope.displayedTotal)} units`}
            >
              {formatUnits(scope.displayedTotal)}
            </TableCell>
            {COLUMNS.map((c) => {
              const value = scope.columnTotals[c.key];
              const share = scope.displayedTotal > 0 ? value / scope.displayedTotal : 0;
              return (
                <TableCell
                  key={c.key}
                  // Deliberately unshaded. The ramp ranks single cells, and a column total is
                  // a sum of hundreds of them — every one of these would peg green and say
                  // nothing, while implying it means what a green in the grid means.
                  className={cn(
                    'sticky z-20 border-b-2 border-primary/40 bg-card px-2 py-1.5 text-center font-mono font-bold tabular-nums',
                    TOTALS_TEXT,
                    TOTALS_TOP,
                    value > 0 ? 'text-foreground' : 'text-muted-foreground/60',
                  )}
                  title={
                    value > 0
                      ? `${c.label}: ${formatUnits(value)} units (${formatPct(share)} of ${scope.label})`
                      : `${c.label}: nothing dispatched in ${scope.label}`
                  }
                >
                  {value > 0 ? formatShort(value) : '·'}
                </TableCell>
              );
            })}
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.sku.id} className="hover:bg-transparent">
              <TableCell
                className={cn(
                  'sticky left-0 z-10 truncate bg-card py-1 font-semibold text-foreground',
                  CELL_TEXT,
                  NAME_W,
                )}
                title={`${row.sku.sheetName} · ${row.sku.id}`}
              >
                {row.sku.name}
              </TableCell>

              <TableCell
                className={cn(
                  'sticky z-10 bg-card py-1 text-right font-mono font-bold tabular-nums text-foreground',
                  CELL_TEXT,
                  TOTAL_LEFT,
                  TOTAL_W,
                )}
              >
                {formatUnits(row.rowTotal)}
              </TableCell>

              {COLUMNS.map((c) => {
                const unanswerable = !scope.hasOther && c.key === OTHER_KEY;
                const value = unanswerable ? 0 : row.cells[c.key];
                const cell = shadedCell(value, sorted);
                const share = row.rowTotal > 0 ? value / row.rowTotal : 0;
                return (
                  <TableCell
                    key={c.key}
                    className={cn(
                      'rounded-[3px] px-2 py-1 text-center font-mono font-bold tabular-nums transition-colors',
                      CELL_TEXT,
                      cell.className,
                    )}
                    style={cell.style}
                    title={
                      unanswerable
                        ? `${row.sku.name} → ${c.label}: no dated tab for these channels — All time tab only`
                        : value > 0
                          ? `${row.sku.name} → ${c.label}: ${formatUnits(value)} units (${formatPct(share)} of this product)`
                          : `${row.sku.name} → ${c.label}: none`
                    }
                  >
                    {cell.text}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
