import { describe, expect, it } from 'vitest';
import { formatPer100 } from '../../src/core/format';

describe('formatPer100', () => {
  it('formats small values with two decimals', () => {
    expect(formatPer100(85.114, 'mass', false)).toBe('₹85.11 / 100 g');
    expect(formatPer100(99, 'volume', false)).toBe('₹99.00 / 100 ml');
  });
  it('rounds large values and groups digits the Indian way', () => {
    expect(formatPer100(746.67, 'mass', false)).toBe('₹747 / 100 g');
    expect(formatPer100(123456.4, 'mass', false)).toBe('₹1,23,456 / 100 g');
  });
  it('marks cross-unit comparisons with ≈', () => {
    expect(formatPer100(99, 'volume', true)).toBe('≈ ₹99.00 / 100 ml');
  });
});
