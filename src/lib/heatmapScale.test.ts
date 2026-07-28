import { describe, expect, it } from 'vitest';

import { domain, fill, position } from './heatmapScale';

// The scale is the whole reason the grid is readable from across a room, and it is a pure
// function — so it is pinned here rather than left to be judged by eye on the wall.

describe('domain', () => {
  it('sorts ascending', () => {
    expect(domain([30, 10, 20])).toEqual([10, 20, 30]);
  });

  it('drops empty cells, which are most of the grid', () => {
    // With zeros in the domain every real value would sit in the top half and render green.
    expect(domain([0, 0, 0, 10, 20, 30])).toEqual([10, 20, 30]);
    expect(domain([0, 0])).toEqual([]);
  });
});

describe('position', () => {
  const GRID = domain([0, 0, 1, 10, 100, 1000, 10000]);

  it('anchors red at the smallest cell, yellow in the middle, green at the largest', () => {
    expect(position(1, GRID)).toBe(0);
    expect(position(100, GRID)).toBe(0.5);
    expect(position(10000, GRID)).toBe(1);
  });

  it('leaves empty cells off the ramp entirely', () => {
    // Zero must render as "nothing", not as alarm-red — the grid is mostly zeros.
    expect(position(0, GRID)).toBe(0);
  });

  it('gives the same value the same colour wherever it appears', () => {
    // The point of the whole change: colour is a property of the number, not of its row.
    expect(position(100, GRID)).toBe(position(100, GRID));
    expect(position(224, domain([224, 1, 57, 21900]))).toBe(
      position(224, domain([1, 57, 224, 21900])),
    );
  });

  it('ties take the same mid-rank', () => {
    const tied = domain([5, 5, 5, 900]);
    expect(position(5, tied)).toBe(position(5, tied));
    expect(position(5, tied)).toBeCloseTo(1 / 3);
    expect(position(900, tied)).toBe(1);
  });

  it('rises monotonically across the whole grid', () => {
    let previous = -1;
    for (const v of [0, 1, 5, 10, 50, 100, 500, 1000, 5000, 10000, 99999]) {
      const t = position(v, GRID);
      expect(t).toBeGreaterThanOrEqual(previous);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(1);
      previous = t;
    }
  });

  it('ranks rather than measures, so the skew cannot flatten the grid', () => {
    // One cell is 100x everything else. Under a linear ramp the rest would all be red.
    const skewed = domain([1, 2, 3, 400]);
    expect(position(2, skewed)).toBeGreaterThan(0.25);
    expect(position(3, skewed)).toBeGreaterThan(0.5);
  });

  it('survives a degenerate grid rather than dividing by zero', () => {
    expect(position(50, [50])).toBe(1);
    expect(position(5, [])).toBe(0);
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
