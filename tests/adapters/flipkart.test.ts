import { beforeEach, describe, expect, it } from 'vitest';
import { flipkart } from '../../src/adapters/flipkart';
import { pickAdapter } from '../../src/adapters';
import { analyzeCard } from '../../src/core/analyze';
import { mountFixture } from '../helpers';

const QUERIES = ['sunscreen', 'shampoo', 'potato-chips', 'wheat-flour-atta'];
const cards = () => Array.from(document.querySelectorAll(flipkart.cardSelector));

describe('flipkart adapter: routing', () => {
  it('matches flipkart.com /search only', () => {
    expect(flipkart.matches(new URL('https://www.flipkart.com/search?q=x'))).toBe(true);
    expect(flipkart.matches(new URL('https://www.amazon.in/s?k=x'))).toBe(false);
    expect(flipkart.isListingPage(new URL('https://www.flipkart.com/search?q=x'))).toBe(true);
    expect(flipkart.isListingPage(new URL('https://www.flipkart.com/'))).toBe(false);
    expect(pickAdapter(new URL('https://www.flipkart.com/search?q=x'))).toBe(flipkart);
  });
  it('reorders by filling DOM slots (cards live in rows of four)', () => {
    expect(flipkart.reorder).toBe('dom-slots');
  });
});

describe('flipkart adapter: sunscreen fixture', () => {
  beforeEach(() => mountFixture('flipkart/sunscreen'));

  it('finds 40 cards', () => {
    expect(cards()).toHaveLength(40);
  });

  it('extracts the first card exactly', () => {
    const raw = flipkart.extract(cards()[0]);
    expect(raw.title).toMatch(/^UNDERATED Sunscreen - SPF 50 PA\+\+\+\+/);
    expect(raw.title.endsWith('...')).toBe(false);
    expect(raw.sizeText).toBe('100 g');
    expect(raw.priceText).toBe('₹348');
    expect(raw.unitPriceText).toBeNull();
    expect(raw.href).toContain('/p/itm');
    const a = analyzeCard(raw);
    expect(a.per100).toBeCloseTo(348, 1);
  });

  it('reads the selling price, not the MRP', () => {
    const raw = flipkart.extract(cards()[2]);
    expect(raw.priceText).toBe('₹120');
  });
});

describe.each(QUERIES)('flipkart adapter: %s fixture', (q) => {
  beforeEach(() => mountFixture(`flipkart/${q}`));

  it('ranks at least 90% of cards', () => {
    const analyses = cards().map((c) => analyzeCard(flipkart.extract(c)));
    const ranked = analyses.filter((a) => a.state === 'ranked');
    expect(analyses.length).toBeGreaterThan(30);
    expect(ranked.length / analyses.length).toBeGreaterThanOrEqual(0.9);
  });

  it('every card is a direct child of a row that holds only cards', () => {
    for (const c of cards()) {
      const kids = Array.from(c.parentElement!.children);
      expect(kids.every((k) => k.matches(flipkart.cardSelector))).toBe(true);
    }
  });
});
