import { describe, expect, it } from 'vitest';

import { MAX_PX, MIN_PX, fitFontSize } from './gridFit';

// The whole point of this function is that nobody has to check the wall display by eye after
// a row is added to the sheet, so the boundaries are pinned here.

describe('fitFontSize', () => {
  it('takes the cap when a 1080p TV shows the full 23-SKU catalogue', () => {
    // ~875px is what the grid card gets on a 1080-tall viewport once the header, the KPI row
    // and the page padding have taken their share.
    expect(fitFontSize(875, 23)).toBe(MAX_PX);
  });

  it('backs off rather than overflowing once the rows stop fitting', () => {
    // At 23 rows the band between cap and floor is roughly 605-750px of grid; below that the
    // catalogue simply does not fit at a legible size.
    const t = fitFontSize(700, 23);
    expect(t).toBeLessThan(MAX_PX);
    expect(t).toBeGreaterThan(MIN_PX);
  });

  it('sizes to a height the grid really occupies', () => {
    // The regression this guards: the first version modelled a row as a plain multiple of the
    // font size, but the padding is fixed px, so it computed a size that then overflowed by
    // ~70px. Rebuild the row heights from the returned size and check they fit.
    for (const avail of [575, 700, 875, 1000]) {
      const f = fitFontSize(avail, 23);
      const height = 2 * f + 2 + (1.15 * 1.05 * f + 16) + 23 * (1.15 * f + 10);
      if (f > MIN_PX) expect(height).toBeLessThanOrEqual(avail);
    }
  });

  it('stops at the floor instead of shrinking to nothing', () => {
    // A 720p TV cannot show 23 rows at a legible size. Hitting the floor means the grid
    // scrolls, which beats type nobody can read from any distance.
    expect(fitFontSize(300, 23)).toBe(MIN_PX);
    expect(fitFontSize(40, 23)).toBe(MIN_PX);
  });

  it('never grows as rows are added', () => {
    let previous = Infinity;
    for (let rows = 0; rows <= 60; rows += 1) {
      const t = fitFontSize(700, rows);
      expect(t).toBeLessThanOrEqual(previous);
      expect(t).toBeGreaterThanOrEqual(MIN_PX);
      expect(t).toBeLessThanOrEqual(MAX_PX);
      previous = t;
    }
  });

  it('survives a container that has not been measured yet', () => {
    // First paint, a collapsed flex child, a hidden tab — all report 0 rather than throwing.
    expect(fitFontSize(0, 23)).toBe(MIN_PX);
    expect(fitFontSize(-50, 23)).toBe(MIN_PX);
    expect(fitFontSize(875, 0)).toBe(MAX_PX);
    expect(fitFontSize(875, -3)).toBe(MAX_PX);
  });

  it('returns whole pixels, so the browser is not left rounding sub-pixel type', () => {
    for (const rows of [7, 13, 19, 23]) {
      expect(fitFontSize(731, rows) % 1).toBe(0);
    }
  });
});
