import { describe, expect, it } from 'vitest';
import { parsePrice } from '../../src/core/price';

describe('parsePrice', () => {
  it.each([
    ['₹224', 224],
    ['₹1,299', 1299],
    ['₹1,29,999.00', 129999],
    ['₹ 506.90', 506.9],
    ['224', 224],
    ['Rs. 99', 99],
    ['₹56.', 56],
    ['  ₹120 \n', 120],
  ])('%j -> %d', (text, expected) => {
    expect(parsePrice(text)).toBeCloseTo(expected, 2);
  });

  it.each([
    ['₹1,299 ₹1,999'],
    ['₹251₹279'],
    ['₹80 delivery'],
    ['10% off'],
    ['M.R.P: ₹249'],
    ['Free'],
    [''],
    ['₹0'],
  ])('rejects %j', (text) => {
    expect(parsePrice(text)).toBeNull();
  });

  it('handles null and undefined', () => {
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice(undefined)).toBeNull();
  });
});
