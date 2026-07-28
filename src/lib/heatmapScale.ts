// The heatmap's colour scale. Pure, and kept out of the component so it can be pinned by
// tests rather than judged by eye on the wall.
//
// ONE scale for the whole grid: a number is green because it is large, full stop. The scale
// used to be computed per row, which meant 17 units could be green on one line while 224 was
// red two lines down — the same colour making two different statements. Whoever is reading
// this from across the room cannot hold a different key in their head for every row.

export const LOW = '#f8696b';
export const MID = '#ffeb84';
export const HIGH = '#63be7b';

/**
 * Every filled cell is a light pastel, so ink is dark unconditionally. Neutral, not tinted:
 * it tracks the page's own surface family, which is now black rather than teal.
 */
export const INK = '#0a0a0a';

/**
 * The sorted list of every filled cell in the grid — the scale's domain.
 *
 * Zeros are dropped: most cells are empty, they render as "nothing" rather than as the low
 * end of the ramp, and letting them into the domain would shove every real value up into the
 * green half.
 */
export function domain(values: number[]): number[] {
  return values.filter((v) => v > 0).sort((a, b) => a - b);
}

/**
 * Where a value sits in the grid: 0 = red, 0.5 = yellow, 1 = green.
 *
 * Rank, not magnitude. Channel volume is violently skewed — Blinkit alone is over half of
 * everything — so a linear ramp from 1 to 21,900 units puts all but a handful of cells inside
 * the bottom 5% and paints the grid flat red. Ranking spreads the colour evenly across the
 * cells that actually exist, which is what makes the middle of the grid readable at all.
 *
 * Ties take the mid-rank, so equal values are always exactly the same colour.
 */
export function position(value: number, sorted: number[]): number {
  if (value <= 0 || sorted.length === 0) return 0;
  if (sorted.length === 1) return 1;

  // First index holding `value`, and the first index past it.
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (sorted[m] < value) lo = m + 1;
    else hi = m;
  }
  let end = lo;
  while (end < sorted.length && sorted[end] === value) end += 1;

  const rank = end > lo ? (lo + end - 1) / 2 : lo - 0.5;
  return Math.min(1, Math.max(0, rank / (sorted.length - 1)));
}

export function fill(t: number): string {
  return t <= 0.5
    ? `color-mix(in oklab, ${MID} ${(t * 200).toFixed(1)}%, ${LOW})`
    : `color-mix(in oklab, ${HIGH} ${((t - 0.5) * 200).toFixed(1)}%, ${MID})`;
}
