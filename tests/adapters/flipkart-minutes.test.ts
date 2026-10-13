import { beforeEach, describe, expect, it } from 'vitest';
import { flipkartMinutes } from '../../src/adapters/flipkart-minutes';
import { pickAdapter } from '../../src/adapters';
import { flipkart } from '../../src/adapters/flipkart';
import { analyzeCard } from '../../src/core/analyze';
import { mountFixture } from '../helpers';

const cards = () => flipkartMinutes.findCards(document);

describe('flipkart minutes: routing', () => {
  const minutes = new URL('https://www.flipkart.com/search?q=sunscreen&marketplace=HYPERLOCAL&pageUID=1');
  it('matches only searches on the HYPERLOCAL marketplace', () => {
    expect(flipkartMinutes.matches(minutes)).toBe(true);
    expect(flipkartMinutes.matches(new URL('https://www.flipkart.com/search?q=x'))).toBe(false);
    expect(flipkartMinutes.matches(new URL('https://www.flipkart.com/search?q=x&marketplace=GROCERY'))).toBe(false);
    expect(flipkartMinutes.isListingPage(minutes)).toBe(true);
    expect(flipkartMinutes.isListingPage(new URL('https://www.flipkart.com/?marketplace=HYPERLOCAL'))).toBe(false);
  });
  it('wins over the normal Flipkart adapter on the same domain, and loses to it otherwise', () => {
    expect(pickAdapter(minutes)).toBe(flipkartMinutes);
    expect(pickAdapter(new URL('https://www.flipkart.com/search?q=x'))).toBe(flipkart);
  });
  it('reorders by filling DOM slots', () => {
    expect(flipkartMinutes.reorder).toBe('dom-slots');
  });
});

describe('flipkart minutes: sunscreen fixture', () => {
  beforeEach(() => mountFixture('flipkart-minutes/sunscreen'));

  it('finds the eight cards in two rows of four', () => {
    expect(cards()).toHaveLength(8);
    expect(cards().every((c) => c.parentElement!.children.length === 4)).toBe(true);
  });

  it('reads the first card: selling price (not the struck MRP), size line and title', () => {
    const raw = flipkartMinutes.extract(cards()[0]);
    expect(raw.title).toMatch(/^Minimalist Sunscreen - SPF 50 PA\+\+\+\+/);
    expect(raw.sizeText).toBe('30 g, 50');
    expect(raw.priceText).toBe('₹214'); // MRP ₹249 is struck through; ₹209 is the XtraSaver member price
    expect(raw.sponsored).toBe(true);
    expect(analyzeCard(raw).per100).toBeCloseTo(713.33, 1);
  });

  it('reads a ml card as volume', () => {
    const a = analyzeCard(flipkartMinutes.extract(cards()[2]));
    expect(a.quantity!.dim).toBe('volume');
    expect(a.per100).toBeCloseTo(498, 0); // ₹249 for 50 ml
  });
});

describe.each(['sunscreen', 'potato-chips', 'atta'])('flipkart minutes: %s fixture', (q) => {
  beforeEach(() => mountFixture(`flipkart-minutes/${q}`));

  it('ranks at least 90% of cards and never reads an MRP as the price', () => {
    const analyses = cards().map((c) => analyzeCard(flipkartMinutes.extract(c)));
    expect(analyses.length).toBeGreaterThanOrEqual(8);
    expect(analyses.filter((a) => a.state === 'ranked').length / analyses.length).toBeGreaterThanOrEqual(0.9);
    for (const c of cards()) {
      const raw = flipkartMinutes.extract(c);
      const mrp = c.querySelector('[data-ps-struck]');
      if (mrp && raw.priceText) expect(raw.priceText).not.toBe(mrp.textContent!.trim());
    }
  });
});

describe('flipkart minutes: chips and atta spot checks', () => {
  it('chips: 81 g at ₹28', () => {
    mountFixture('flipkart-minutes/potato-chips');
    const a = analyzeCard(flipkartMinutes.extract(cards()[0]));
    expect(a.price).toBe(28);
    expect(a.per100).toBeCloseTo(34.57, 1);
  });
  it('atta: 5 kg at ₹218 (a card with the short title "Wheat Atta")', () => {
    mountFixture('flipkart-minutes/atta');
    const wheat = cards().find((c) => flipkartMinutes.extract(c).title === 'Wheat Atta')!;
    expect(wheat).toBeDefined();
    const a = analyzeCard(flipkartMinutes.extract(wheat));
    expect(a.price).toBe(218);
    expect(a.per100).toBeCloseTo(4.36, 1);
  });
  it('atta: 20 separate cards, none containing another, four per row', () => {
    mountFixture('flipkart-minutes/atta');
    const list = cards();
    expect(list).toHaveLength(20);
    expect(list.some((c) => list.some((o) => o !== c && c.contains(o)))).toBe(false);
    expect(list.every((c) => c.parentElement!.children.length === 4)).toBe(true);
  });
});
