import { describe, expect, it } from 'vitest';

import { MAX_PX, MIN_PX, fitFontSize, maxFontSize } from './gridFit';

// The whole point of this function is that nobody has to check the wall display by eye after
// a row is added to the sheet, so the boundaries are pinned here.

describe('maxFontSize', () => {
  // ~890px is what the grid card gets on a 1080-tall viewport once the header, the KPI row
  // and the page padding have taken their share; a 4K panel reporting the full 2160 gives
  // roughly double that.
  const GRID_1080 = 890;
  const GRID_4K = 1900;

  it('lands on the signed-off size for a 1080 screen', () => {
    expect(maxFontSize(GRID_1080)).toBe(MAX_PX);
  });

  it('scales up on a 4K panel, so the type keeps its angular size across the room', () => {
    // The bug this guards: a flat cap renders half as big on a 4K browser reporting 3840x2160,
    // because a CSS pixel there is half the physical size.
    const big = maxFontSize(GRID_4K);
    expect(big).toBeGreaterThan(MAX_PX);
    // Same fraction of the screen, within a pixel of rounding.
    expect(big / GRID_4K).toBeCloseTo(MAX_PX / GRID_1080, 2);
  });

  it('never goes below the 1080 size, however short the box', () => {
    expect(maxFontSize(300)).toBe(MAX_PX);
    expect(maxFontSize(0)).toBe(MAX_PX);
  });

  it('stops before the grid turns into a poster', () => {
    expect(maxFontSize(99999)).toBeLessThanOrEqual(56);
  });
});

describe('fitFontSize', () => {
  it('takes the cap when a 1080p TV shows the full 23-SKU catalogue', () => {
    expect(fitFontSize(875, 23)).toBe(maxFontSize(875));
  });

  it('never exceeds the cap for its own box', () => {
    for (const avail of [575, 800, 890, 1400, 1900, 2400]) {
      expect(fitFontSize(avail, 23)).toBeLessThanOrEqual(maxFontSize(avail));
    }
  });

  it('backs off rather than overflowing once the rows stop fitting', () => {
    // At 23 rows the band between cap and floor is only ~750-840px of grid: the two limits
    // are close together on purpose, because the range where 23 rows both fit AND stay
    // readable from a distance is genuinely narrow.
    const t = fitFontSize(800, 23);
    expect(t).toBeLessThan(MAX_PX);
    expect(t).toBeGreaterThan(MIN_PX);
  });

  it('sizes to a height the grid really occupies', () => {
    // The regression this guards: the first version modelled a row as a plain multiple of the
    // font size, but the padding is fixed px, so it computed a size that then overflowed by
    // ~70px. Rebuild the row heights from the returned size and check they fit.
    for (const avail of [575, 700, 875, 1000]) {
      const f = fitFontSize(avail, 23);
      const height = 2 * f + 2 + (1.15 * 1.1 * f + 16) + 23 * (1.15 * f + 10);
      if (f > MIN_PX) expect(height).toBeLessThanOrEqual(avail);
    }
  });

  it('stops at the floor instead of shrinking to nothing', () => {
    // A short window cannot show 23 rows at a legible size. Hitting the floor means the grid
    // scrolls, which beats type nobody can read from any distance — the whole reason the
    // floor is 16px and not 11: a browser window with devtools open used to land on 11 and
    // the grid was unreadable, which is the exact failure this guards.
    expect(fitFontSize(540, 23)).toBe(MIN_PX);
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
