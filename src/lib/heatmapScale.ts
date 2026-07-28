// The heatmap's colour scale. Pure, and kept out of the component so it can be pinned by
// tests rather than judged by eye on the wall.
//
// Excel's 3-colour scale, applied PER ROW: the question the grid answers is "where does THIS
// product go", not "which cell is biggest overall" — a global scale would flatten everything
// but Blinkit.

export const LOW = '#f8696b';
export const MID = '#ffeb84';
export const HIGH = '#63be7b';

/** Every filled cell is a light pastel, so ink is dark unconditionally. */
export const INK = '#08181a';

/**
 * Yellow sits at the row's MEDIAN, not the mid-point of its range — Excel's own
 * percentile-50 default.
 *
 * Channel volume is violently skewed: Blinkit alone is over half of everything. Anchoring
 * yellow at (min+max)/2 drops all but the dominant cell onto flat red and destroys the very
 * ranking the colour is there to show. The median keeps the mid band populated.
 *
 * Zeros are excluded — most cells in a row are empty, and letting them vote would drag the
 * median to 0 and paint every real value green.
 */
export function median(values: number[]): number {
  const nonZero = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (!nonZero.length) return 0;
  const half = nonZero.length >> 1;
  return nonZero.length % 2 ? nonZero[half] : (nonZero[half - 1] + nonZero[half]) / 2;
}

/** 0 = red, 0.5 = yellow (the median), 1 = green (the row max). */
export function position(value: number, mid: number, max: number): number {
  if (value <= 0) return 0;
  if (value >= mid) return max > mid ? 0.5 + (0.5 * (value - mid)) / (max - mid) : 1;
  return mid > 0 ? (0.5 * value) / mid : 0;
}

export function fill(t: number): string {
  return t <= 0.5
    ? `color-mix(in oklab, ${MID} ${(t * 200).toFixed(1)}%, ${LOW})`
    : `color-mix(in oklab, ${HIGH} ${((t - 0.5) * 200).toFixed(1)}%, ${MID})`;
}
