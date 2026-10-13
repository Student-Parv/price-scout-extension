import { beforeEach, describe, expect, it } from 'vitest';
import { dmart } from '../../src/adapters/dmart';
import { pickAdapter } from '../../src/adapters';
import { analyzeCard } from '../../src/core/analyze';
import { parseQuantity } from '../../src/core/quantity';
import { mountFixture } from '../helpers';

const cards = () => dmart.findCards(document);

describe('dmart: routing', () => {
  it('matches dmart.in search pages', () => {
    expect(dmart.matches(new URL('https://www.dmart.in/search?searchTerm=x'))).toBe(true);
    expect(dmart.matches(new URL('https://www.amazon.in/s?k=x'))).toBe(false);
    expect(dmart.isListingPage(new URL('https://www.dmart.in/search?searchTerm=x'))).toBe(true);
    expect(dmart.isListingPage(new URL('https://www.dmart.in/product/x?selectedProd=1'))).toBe(false);
    expect(pickAdapter(new URL('https://www.dmart.in/search?searchTerm=x'))).toBe(dmart);
  });
  it('reorders the grid items with CSS order', () => {
    expect(dmart.reorder).toBe('css-order');
  });
});

describe('dmart: sunscreen fixture', () => {
  beforeEach(() => mountFixture('dmart/sunscreen'));

  it('finds product cards and nothing else', () => {
    expect(cards().length).toBeGreaterThan(30);
    expect(cards().every((c) => c.querySelector('a[href^="/product/"]'))).toBe(true);
  });

  it('reads the first card: not the MRP, not the "₹194 OFF" badge', () => {
    const raw = dmart.extract(cards()[0]);
    expect(raw.title).toBe('Cetaphil Sunscreen SPF 50+ Light Gel : 50 ml');
    expect(raw.priceText).toBe('₹ 1105');
    expect(raw.sizeText).toBe('50 ml');
    expect(raw.unitPriceText).toBeNull(); // the printed unit price is rounded and sometimes wrong, so it is ignored
    expect(raw.href).toMatch(/^\/product\//);
    const a = analyzeCard(raw);
    expect(a.per100).toBeCloseTo(2210, 0); // ₹1105 / 50 ml
    expect(a.note).toBeNull();
  });

  it('sorts the grid item wrapper, not the card inside it', () => {
    const card = cards()[0];
    expect(dmart.sortNode(card)).toBe(card.closest('.MuiGrid-item'));
    expect(dmart.sortNode(card)).not.toBe(card);
  });

  it('every grid item shares one parent (so CSS order can reorder them)', () => {
    const parents = new Set(cards().map((c) => dmart.sortNode(c).parentElement));
    expect(parents.size).toBe(1);
  });
});

describe.each(['sunscreen', 'potato-chips', 'shampoo'])('dmart: %s fixture', (q) => {
  beforeEach(() => mountFixture(`dmart/${q}`));

  it('ranks every card (all are sold by weight or volume)', () => {
    const analyses = cards().map((c) => analyzeCard(dmart.extract(c)));
    expect(analyses.length).toBeGreaterThan(15);
    expect(analyses.filter((a) => a.state === 'ranked')).toHaveLength(analyses.length);
  });

  it("the size selector and the title agree (DMart's own unit price is not trusted, see the adapter)", () => {
    for (const c of cards()) {
      const raw = dmart.extract(c);
      const bySize = parseQuantity(raw.sizeText);
      const byTitle = parseQuantity(raw.title);
      if (bySize && byTitle) expect(bySize.value).toBeCloseTo(byTitle.value, 1);
    }
  });

  it('keeps the exact size where the printed unit price is off (₹347 for 400 ml is ₹86.75 per 100 ml, not 93)', () => {
    if (q !== 'shampoo') return;
    const card = cards().find((c) => dmart.extract(c).title.startsWith('Mamaearth Gentle Cleansing Shampoo For Babies'))!;
    expect(analyzeCard(dmart.extract(card)).per100).toBeCloseTo(86.75, 2);
  });
});

describe('dmart: atta fixture (also lists sieves, tawas and books)', () => {
  beforeEach(() => mountFixture('dmart/atta'));

  it('ranks the flour and leaves unit-sold goods as unknown instead of guessing', () => {
    const analyses = cards().map((c) => analyzeCard(dmart.extract(c)));
    const ranked = analyses.filter((a) => a.state === 'ranked');
    const unknown = analyses.filter((a) => a.state === 'unknown');
    expect(ranked.length).toBeGreaterThan(40);
    expect(unknown.length).toBeGreaterThan(5);
    expect(ranked.length + unknown.length).toBe(analyses.length);
  });

  it('10 kg Aashirvaad atta at ₹562 is ₹5.62 per 100 g', () => {
    const a = analyzeCard(dmart.extract(cards()[0]));
    expect(a.per100).toBeCloseTo(5.62, 2);
  });
});
