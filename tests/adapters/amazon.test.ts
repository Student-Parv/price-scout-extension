import { beforeEach, describe, expect, it } from 'vitest';
import { amazon } from '../../src/adapters/amazon';
import { pickAdapter } from '../../src/adapters';
import { analyzeCard } from '../../src/core/analyze';
import { mountFixture } from '../helpers';

const QUERIES = ['sunscreen', 'potato-chips', 'wheat-flour-atta', 'shampoo'];
const cards = () => Array.from(document.querySelectorAll(amazon.cardSelector));

describe('amazon adapter: routing', () => {
  it('matches amazon.in search pages only', () => {
    expect(amazon.matches(new URL('https://www.amazon.in/s?k=x'))).toBe(true);
    expect(amazon.matches(new URL('https://www.amazon.com/s?k=x'))).toBe(false);
    expect(amazon.isListingPage(new URL('https://www.amazon.in/s?k=x'))).toBe(true);
    expect(amazon.isListingPage(new URL('https://www.amazon.in/dp/B0CW5BK193'))).toBe(false);
    expect(pickAdapter(new URL('https://www.amazon.in/s?k=x'))).toBe(amazon);
    expect(pickAdapter(new URL('https://example.com/'))).toBeNull();
  });
  it('reorders with CSS order', () => {
    expect(amazon.reorder).toBe('css-order');
  });
});

describe('amazon adapter: sunscreen fixture', () => {
  beforeEach(() => mountFixture('amazon/sunscreen'));

  it('finds 48 result cards', () => {
    expect(cards()).toHaveLength(48);
  });

  it('extracts the first card exactly', () => {
    const raw = amazon.extract(cards()[0]);
    expect(raw.title).toMatch(/^Minimalist Sunscreen SPF 50/);
    expect(raw.title).toMatch(/30gm$/);
    expect(raw.priceText).toBe('₹224');
    expect(raw.unitPriceText).toContain('746.67');
    expect(raw.unitPriceText).toContain('/100 g');
    expect(raw.outOfStock).toBe(false);
    expect(raw.href).toMatch(/^\//);
    const a = analyzeCard(raw);
    expect(a.state).toBe('ranked');
    expect(a.per100).toBeCloseTo(746.67, 1);
  });

  it('does not mistake the unit price or MRP for the selling price', () => {
    for (const c of cards()) {
      const raw = amazon.extract(c);
      if (raw.priceText) expect(raw.priceText).toMatch(/^₹[\d,]+(\.\d+)?$/);
    }
  });
});

describe.each(QUERIES)('amazon adapter: %s fixture', (q) => {
  beforeEach(() => mountFixture(`amazon/${q}`));

  it('ranks at least 90% of priced cards', () => {
    const analyses = cards().map((c) => analyzeCard(amazon.extract(c)));
    const priced = analyses.filter((a) => a.price !== null);
    const ranked = priced.filter((a) => a.state === 'ranked');
    expect(priced.length).toBeGreaterThan(20);
    expect(ranked.length / priced.length).toBeGreaterThanOrEqual(0.9);
  });

  it('flags unavailable cards instead of ranking them', () => {
    for (const c of cards()) {
      const raw = amazon.extract(c);
      if (raw.priceText === null && /currently unavailable/i.test(c.textContent ?? '')) {
        expect(analyzeCard(raw).state).toBe('unavailable');
      }
    }
  });

  it('title text and the site unit price agree on at least 90% of cards that have both', () => {
    let both = 0;
    let disagree = 0;
    for (const c of cards()) {
      const a = analyzeCard(amazon.extract(c));
      if (a.quantity?.source === 'site-unit-price') {
        both++;
        if (a.note) disagree++;
      }
    }
    // `note` is set only when a title quantity exists AND differs from the unit price.
    expect(both).toBeGreaterThan(20);
    expect(disagree / both).toBeLessThanOrEqual(0.1);
  });
});
