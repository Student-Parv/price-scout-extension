import { describe, expect, it } from 'vitest';
import { parseUnitPrice, quantityFromUnitPrice } from '../../src/core/unitprice';

describe('parseUnitPrice', () => {
  it('reads the duplicated Amazon text (offscreen + visible)', () => {
    expect(parseUnitPrice('(₹746.67₹746.67/100 g)')).toEqual({ price: 746.67, perAmount: 100, unit: 'g' });
  });
  it('reads spaced and per-kg forms', () => {
    expect(parseUnitPrice('( ₹85.11 ₹85.11/100 g)')).toEqual({ price: 85.11, perAmount: 100, unit: 'g' });
    expect(parseUnitPrice('(₹1,450₹1,450/100 g)')).toEqual({ price: 1450, perAmount: 100, unit: 'g' });
    expect(parseUnitPrice('(₹47₹47/kg)')).toEqual({ price: 47, perAmount: 1, unit: 'kg' });
    expect(parseUnitPrice('(₹398₹398/100 ml)')).toEqual({ price: 398, perAmount: 100, unit: 'ml' });
  });
  it('ignores count and month based unit prices', () => {
    expect(parseUnitPrice('(₹49₹49/count)')).toBeNull();
    expect(parseUnitPrice('EMI from ₹5,000/month')).toBeNull();
  });
  it('returns null for text without a unit price', () => {
    expect(parseUnitPrice('₹224')).toBeNull();
    expect(parseUnitPrice('')).toBeNull();
  });
});

describe('quantityFromUnitPrice', () => {
  it('derives 30 g from ₹224 at ₹746.67/100 g', () => {
    const q = quantityFromUnitPrice(224, { price: 746.67, perAmount: 100, unit: 'g' })!;
    expect(q.value).toBeCloseTo(30, 2);
    expect(q.dim).toBe('mass');
    expect(q.source).toBe('site-unit-price');
    expect(q.confidence).toBe('high');
  });
  it('converts kg to grams', () => {
    const q = quantityFromUnitPrice(239, { price: 47.8, perAmount: 1, unit: 'kg' })!;
    expect(q.value).toBeCloseTo(5000, 0);
  });
  it('derives volume', () => {
    const q = quantityFromUnitPrice(198, { price: 99, perAmount: 100, unit: 'ml' })!;
    expect(q.value).toBeCloseTo(200, 2);
    expect(q.dim).toBe('volume');
  });
  it('rejects non-positive input', () => {
    expect(quantityFromUnitPrice(0, { price: 10, perAmount: 100, unit: 'g' })).toBeNull();
    expect(quantityFromUnitPrice(10, { price: 0, perAmount: 100, unit: 'g' })).toBeNull();
  });
});
