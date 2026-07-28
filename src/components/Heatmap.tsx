import { useMemo } from 'react';

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
      className: 'text-muted-foreground/30',
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
 * 20rem is wide enough for the longest display name (47 chars) without an ellipsis. On a
 * phone that is the entire viewport, which left no room at all for the data, so below `lg`
 * the column narrows to 10rem and names fall back to their `truncate` + tooltip.
 *
 * The switch is at `lg`, not `md`: on a tablet the wide name column would eat 320 of ~700px
 * and squeeze the channels to 49px, narrower than the 69px they get here.
 */
const NAME_W = 'w-[10rem] min-w-[10rem] max-w-[10rem] lg:w-[20rem] lg:min-w-[20rem] lg:max-w-[20rem]';
const TOTAL_W = 'w-[5.5rem] min-w-[5.5rem]';
/** Sticky offset for the Total column = the name column plus one border-spacing step. */
const TOTAL_LEFT = 'left-[10.25rem] lg:left-[20.25rem]';

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

  return (
    // The height has to land on the table's own container — that div carries `overflow-x-auto`,
    // which makes it the scrollport, and sticky rows/columns only stick inside a scrollport
    // that is actually bounded.
    <div className="h-full min-h-0 [&>[data-slot=table-container]]:h-full">
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
              className={cn('eyebrow sticky top-0 left-0 z-30 h-7 bg-card text-left', NAME_W)}
            >
              Product
            </TableHead>
            <TableHead
              className={cn(
                'eyebrow sticky top-0 z-30 h-7 bg-card text-right',
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
                  'eyebrow sticky top-0 z-20 h-7 bg-card text-center whitespace-nowrap',
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
                'eyebrow sticky top-7 left-0 z-30 border-b-2 border-primary/40 bg-card py-1.5 text-foreground',
                NAME_W,
              )}
            >
              All channels
            </TableCell>
            <TableCell
              className={cn(
                'sticky top-7 z-30 border-b-2 border-primary/40 bg-card py-1.5 text-right font-mono text-[13px] font-bold tabular-nums text-foreground',
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
                    'sticky top-7 z-20 border-b-2 border-primary/40 bg-card px-2 py-1.5 text-center font-mono text-[13px] font-bold tabular-nums',
                    value > 0 ? 'text-foreground' : 'text-muted-foreground/30',
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
                  'sticky left-0 z-10 truncate bg-card py-0.5 text-[12px] font-medium text-foreground',
                  NAME_W,
                )}
                title={`${row.sku.sheetName} · ${row.sku.id}`}
              >
                {row.sku.name}
              </TableCell>

              <TableCell
                className={cn(
                  'sticky z-10 bg-card py-0.5 text-right font-mono text-[12px] font-semibold tabular-nums text-foreground',
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
                      'rounded-[3px] px-2 py-0.5 text-center font-mono text-[12px] tabular-nums transition-colors',
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
