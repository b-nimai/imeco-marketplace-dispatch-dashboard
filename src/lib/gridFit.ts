// How big the heatmap's type can be. Pure, and kept out of the component so it can be
// pinned by tests rather than judged by eye on the wall.
//
// The grid is read from across a room, so bigger is always better — but the page is a fixed
// one-screen shell (`lg:h-svh lg:overflow-hidden`) and nobody is standing at the TV to scroll
// a row into view. So the size is not a constant: it is the largest that still fits every row
// on screen, capped so it never gets comic on a short list.

/** Below this the grid is not worth reading from a distance; let it scroll instead. */
export const MIN_PX = 11;
/** ~1.4x the 12px this grid used to be — past here the columns start to crowd. */
export const MAX_PX = 17;

// A row's height is NOT a plain multiple of the font size: the line box scales with the type
// but the padding does not. So each row costs `line * fontPx + padPx`, and the fit is solved
// for `fontPx` across the whole grid.
//
// THESE MUST TRACK Heatmap.tsx. The `line` figures are the `leading-*` on the cells (which
// has to be set explicitly — the table's own `text-sm` otherwise pins every line box at 20px
// no matter what size the text is, which is exactly the bug that made the first version of
// this size the grid to a height it did not really occupy). The `pad` figures are the `py-*`
// plus anything else drawn into the row band.

/** `border-spacing-0.5` — 2px of gutter under every row, header rows included. */
const GAP_PX = 2;
/** `leading-[1.15]` on the data cells. */
const LINE = 1.15;

/** Column headers: `h-[calc(var(--grid-font)*2)]`, so pure font, no padding of their own. */
const HEAD_LINE = 2.0;
const HEAD_PAD = GAP_PX;

/** "All channels": 1.05x type, `py-1.5`, plus the 2px underline under the row. */
const TOTALS_LINE = LINE * 1.05;
const TOTALS_PAD = 12 + 2 + GAP_PX;

/** A product row: `py-1`. */
const ROW_LINE = LINE;
const ROW_PAD = 8 + GAP_PX;

/**
 * The largest font size at which `rowCount` products, plus the two header rows, still fit in
 * `availablePx`.
 *
 * Clamped at both ends: `MAX_PX` when there is room to spare, `MIN_PX` when there is not —
 * hitting the floor means the grid scrolls, which is the lesser evil against type nobody can
 * read at any distance.
 */
export function fitFontSize(availablePx: number, rowCount: number): number {
  const rows = Math.max(0, rowCount);
  const fixed = HEAD_PAD + TOTALS_PAD + ROW_PAD * rows;
  const perPx = HEAD_LINE + TOTALS_LINE + ROW_LINE * rows;
  const room = availablePx - fixed;
  if (!(room > 0)) return MIN_PX;
  return Math.min(MAX_PX, Math.max(MIN_PX, Math.floor(room / perPx)));
}
