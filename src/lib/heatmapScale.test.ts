import { describe, expect, it } from 'vitest';

import { fill, median, position } from './heatmapScale';

// The scale is the whole reason the grid is readable from across a room, and it is a pure
// function — so it is pinned here rather than left to be judged by eye on the wall.

describe('position', () => {
  const MID = 100;
  const MAX = 1000;

  it('anchors red at zero, yellow at the median, green at the max', () => {
    expect(position(0, MID, MAX)).toBe(0);
    expect(position(MID, MID, MAX)).toBe(0.5);
    expect(position(MAX, MID, MAX)).toBe(1);
  });

  it('rises monotonically across the whole range', () => {
    let previous = -1;
    for (let v = 0; v <= MAX; v += 25) {
      const t = position(v, MID, MAX);
      expect(t).toBeGreaterThanOrEqual(previous);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(1);
      previous = t;
    }
  });

  it('keeps sub-median values in the red half and the rest in the green half', () => {
    expect(position(MID / 2, MID, MAX)).toBe(0.25);
    expect(position((MID + MAX) / 2, MID, MAX)).toBeGreaterThan(0.5);
  });

  it('survives a degenerate row rather than dividing by zero', () => {
    // Every cell equal — max === mid. The single populated cell is the row's own maximum.
    expect(position(50, 50, 50)).toBe(1);
    // Nothing in the row at all.
    expect(position(0, 0, 0)).toBe(0);
    // A median of zero cannot scale anything below it; the value is still at or above it.
    expect(position(5, 0, 10)).toBeGreaterThan(0.5);
  });

  it('never treats an empty cell as the low end of the ramp', () => {
    // Zero must render as "nothing", not as alarm-red — the grid is mostly zeros.
    expect(position(0, MID, MAX)).toBe(0);
  });
});

describe('median', () => {
  it('ignores empty cells, which are most of the grid', () => {
    // With zeros counted the median would be 0 and every real value would render green.
    expect(median([0, 0, 0, 10, 20, 30])).toBe(20);
    expect(median([0, 0])).toBe(0);
  });

  it('averages the middle pair on an even count', () => {
    expect(median([10, 20, 30, 40])).toBe(25);
  });
});

describe('fill', () => {
  it('mixes toward yellow below the midpoint and toward green above it', () => {
    expect(fill(0)).toContain('#ffeb84 0.0%');
    expect(fill(0)).toContain('#f8696b');
    expect(fill(0.5)).toContain('#ffeb84 100.0%');
    expect(fill(1)).toContain('#63be7b 100.0%');
  });
});
