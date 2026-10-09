import { describe, expect, it } from 'vitest';
import { analyzeCard } from '../../src/core/analyze';
import type { RawCard } from '../../src/core/types';

const base: RawCard = {
  title: '', sizeText: null, priceText: null, unitPriceText: null,
  deliveryNote: null, href: null, sponsored: false, outOfStock: false,
};
const card = (o: Partial<RawCard>): RawCard => ({ ...base, ...o });

describe('analyzeCard', () => {
  it('prefers the site unit price and agrees with the title', () => {
    const a = analyzeCard(card({
      title: 'Minimalist Sunscreen SPF 50 | 30gm', priceText: '₹224', unitPriceText: '(₹746.67₹746.67/100 g)',
    }));
    expect(a.state).toBe('ranked');
    expect(a.quantity!.source).toBe('site-unit-price');
    expect(a.per100).toBeCloseTo(746.67, 1);
    expect(a.note).toBeNull();
  });

  it('uses the title when there is no unit price', () => {
    const a = analyzeCard(card({ title: 'Pilgrim Shampoo - 200ml', priceText: '₹198' }));
    expect(a.per100).toBeCloseTo(99, 2);
    expect(a.quantity!.dim).toBe('volume');
  });

  it('uses the Flipkart size line before the title', () => {
    const a = analyzeCard(card({ title: 'Lays Chips', sizeText: '4 x 26.75 g', priceText: '₹120' }));
    expect(a.quantity!.value).toBeCloseTo(107, 2);
    expect(a.per100).toBeCloseTo(112.14, 1);
  });

  it('falls back to the title when the size line has no unit', () => {
    const a = analyzeCard(card({ title: 'Shampoo 500 ml', sizeText: '500', priceText: '₹250' }));
    expect(a.per100).toBeCloseTo(50, 2);
  });

  it('keeps the site unit price and notes a title disagreement', () => {
    const a = analyzeCard(card({
      title: 'Sunscreen 50 g', priceText: '₹224', unitPriceText: '(₹746.67₹746.67/100 g)',
    }));
    expect(a.quantity!.value).toBeCloseTo(30, 2);
    expect(a.note).toContain('Title says');
  });

  it('is unknown when no quantity can be read', () => {
    const a = analyzeCard(card({ title: 'Pringles', priceText: '₹120' }));
    expect(a.state).toBe('unknown');
    expect(a.per100).toBeNull();
    expect(a.price).toBe(120);
  });

  it('is unknown without a price and unavailable when flagged', () => {
    expect(analyzeCard(card({ title: 'Atta 5 kg' })).state).toBe('unknown');
    expect(analyzeCard(card({ title: 'Atta 5 kg', outOfStock: true })).state).toBe('unavailable');
    expect(analyzeCard(card({ title: 'Atta 5 kg', priceText: '₹239', outOfStock: true })).state).toBe('unavailable');
  });
});
