import { describe, expect, it } from 'vitest';
import { dominantDim, sortOrder, type SortEntry } from '../../src/core/rank';

const r = (per100: number): SortEntry => ({ per100, state: 'ranked' });
const u: SortEntry = { per100: null, state: 'unknown' };
const n: SortEntry = { per100: null, state: 'unavailable' };

describe('sortOrder', () => {
  it('sorts ranked ascending, then unknown, then unavailable', () => {
    expect(sortOrder([n, r(30), u, r(10), r(20)], 'asc')).toEqual([3, 4, 1, 2, 0]);
  });
  it('sorts ranked descending but keeps unknown/unavailable last', () => {
    expect(sortOrder([n, r(30), u, r(10), r(20)], 'desc')).toEqual([1, 4, 3, 2, 0]);
  });
  it('keeps original order for ties', () => {
    expect(sortOrder([r(5), r(5), r(5)], 'asc')).toEqual([0, 1, 2]);
    expect(sortOrder([r(5), r(5), r(5)], 'desc')).toEqual([0, 1, 2]);
  });
  it('handles empty input', () => {
    expect(sortOrder([], 'asc')).toEqual([]);
  });
});

describe('dominantDim', () => {
  it('returns the majority dimension', () => {
    expect(dominantDim(['mass', 'volume', 'mass'])).toBe('mass');
    expect(dominantDim(['volume', 'volume', 'mass'])).toBe('volume');
  });
  it('breaks ties by first seen and handles empty', () => {
    expect(dominantDim(['volume', 'mass'])).toBe('volume');
    expect(dominantDim([])).toBeNull();
  });
});
