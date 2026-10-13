import { describe, expect, it } from 'vitest';
import { pickAdapter } from '../../src/adapters';
import { bigbasket } from '../../src/adapters/bigbasket';
import { blinkit } from '../../src/adapters/blinkit';
import { instamart } from '../../src/adapters/instamart';
import type { SiteAdapter } from '../../src/adapters/types';
import { zepto } from '../../src/adapters/zepto';
import { analyzeCard } from '../../src/core/analyze';
import { mountFixture } from '../helpers';

interface Site {
  name: string;
  adapter: SiteAdapter;
  listing: string[];
  notListing: string[];
  /** fixture -> minimum share of cards that must be ranked */
  fixtures: Record<string, number>;
  /** [fixture, card index, price, per100 (₹ per 100 g/ml), tooltip fragment] */
  spots: [string, number, number, number][];
}

const SITES: Site[] = [
  {
    name: 'blinkit',
    adapter: blinkit,
    listing: ['https://blinkit.com/s/?q=sunscreen', 'https://www.blinkit.com/s/?q=x'],
    notListing: ['https://blinkit.com/', 'https://blinkit.com/prn/some-product/prid/1'],
    fixtures: { sunscreen: 0.95, 'potato-chips': 0.95, atta: 0.95 },
    spots: [
      ['sunscreen', 0, 388, 776], // 50 g, struck MRP ₹445
      ['potato-chips', 0, 99, 87.61], // 113 g
      ['atta', 0, 319, 6.38], // 5 kg
    ],
  },
  {
    name: 'zepto',
    adapter: zepto,
    listing: ['https://www.zepto.com/search?query=sunscreen', 'https://zepto.com/search?query=x'],
    notListing: ['https://www.zepto.com/', 'https://www.zepto.com/pn/some-product/pvid/1'],
    // chips: many packs say "1 pack (48 g or 58 g)", two different weights, which stay unknown
    fixtures: { sunscreen: 0.95, 'potato-chips': 0.7, atta: 0.95 },
    spots: [
      ['sunscreen', 0, 237, 790], // 1 pc (30 g)
      ['atta', 0, 109, 5.45], // 1 pack (2 kg)
    ],
  },
  {
    name: 'bigbasket',
    adapter: bigbasket,
    listing: ['https://www.bigbasket.com/ps/?q=sunscreen', 'https://bigbasket.com/ps/?q=x'],
    notListing: ['https://www.bigbasket.com/', 'https://www.bigbasket.com/pd/1/some-product/'],
    fixtures: { sunscreen: 0.9, 'potato-chips': 0.9, atta: 0.9 },
    spots: [
      ['sunscreen', 0, 305.03, 305.03], // 100 g
      ['potato-chips', 0, 46.75, 51.94], // 90 g Pouch
      ['atta', 0, 64, 7.11], // 900 g
    ],
  },
  {
    name: 'instamart',
    adapter: instamart,
    listing: ['https://www.swiggy.com/instamart/search?custom_back=true&query=sunscreen'],
    notListing: ['https://www.swiggy.com/', 'https://www.swiggy.com/restaurants', 'https://www.swiggy.com/instamart'],
    fixtures: { sunscreen: 0.9, 'potato-chips': 0.9, atta: 0.9 },
    spots: [
      ['sunscreen', 0, 237, 790], // 30 g, struck MRP 249
      ['potato-chips', 1, 39, 65], // 60 g
      ['atta', 1, 284, 5.68], // 5 kg
    ],
  },
];

describe.each(SITES)('$name', ({ name, adapter, listing, notListing, fixtures, spots }) => {
  it('is picked for its search pages only', () => {
    for (const u of listing) {
      expect(pickAdapter(new URL(u))).toBe(adapter);
      expect(adapter.isListingPage(new URL(u))).toBe(true);
    }
    for (const u of notListing) expect(adapter.isListingPage(new URL(u))).toBe(false);
    expect(pickAdapter(new URL('https://example.com/search?q=x'))).toBeNull();
  });

  describe.each(Object.entries(fixtures))('%s fixture', (q, minShare) => {
    it('finds separate cards and ranks enough of them', () => {
      mountFixture(`${name}/${q}`);
      const cards = adapter.findCards(document);
      expect(cards.length).toBeGreaterThanOrEqual(30);
      expect(cards.some((c) => cards.some((o) => o !== c && c.contains(o)))).toBe(false);
      const analyses = cards.map((c) => analyzeCard(adapter.extract(c)));
      expect(analyses.filter((a) => a.state === 'ranked').length / analyses.length).toBeGreaterThanOrEqual(minShare);
    });

    it('never reads a struck-through old price as the selling price', () => {
      mountFixture(`${name}/${q}`);
      for (const c of adapter.findCards(document)) {
        const raw = adapter.extract(c);
        const struck = Array.from(c.querySelectorAll('[data-ps-struck]')).map((e) => e.textContent!.trim());
        if (raw.priceText && struck.length) expect(struck).not.toContain(raw.priceText);
      }
    });

    it('every ranked card has a plausible price and per-100 value', () => {
      mountFixture(`${name}/${q}`);
      for (const c of adapter.findCards(document)) {
        const a = analyzeCard(adapter.extract(c));
        if (a.state === 'ranked') {
          expect(a.price!).toBeGreaterThan(0);
          // floor is low on purpose: BigBasket shows ₹30.00 for a 10 kg Bharat Atta (₹0.30/100 g), and real bulk water is cheaper still
          expect(a.per100!).toBeGreaterThan(0.1);
          expect(a.per100!).toBeLessThan(20000);
        }
      }
    });
  });

  it.each(spots)('spot check: %s card #%i costs ₹%d, which is ₹%d per 100 g/ml', (q, i, price, per100) => {
    mountFixture(`${name}/${q}`);
    const a = analyzeCard(adapter.extract(adapter.findCards(document)[i]));
    expect(a.state).toBe('ranked');
    expect(a.price).toBeCloseTo(price, 2);
    expect(a.per100).toBeCloseTo(per100, 1);
  });
});

describe('zepto: two different weights in one pack size stay unknown', () => {
  it('"1 pack (48 g or 58 g)" is not guessed', () => {
    mountFixture('zepto/potato-chips');
    const ambiguous = zepto.findCards(document).filter((c) => / or /.test(zepto.extract(c).sizeText ?? ''));
    expect(ambiguous.length).toBeGreaterThan(5);
    for (const c of ambiguous) expect(analyzeCard(zepto.extract(c)).state).toBe('unknown');
  });
});

describe('bigbasket: an out-of-stock item is unavailable, not ranked', () => {
  it('"Notify Me" with a struck price', () => {
    mountFixture('bigbasket/atta');
    const states = bigbasket.findCards(document).map((c) => analyzeCard(bigbasket.extract(c)).state);
    expect(states).toContain('unavailable');
  });
});

describe('instamart: prices are bare numbers', () => {
  it('reads the number as the price and the CSS-drawn ₹ is not needed', () => {
    mountFixture('instamart/sunscreen');
    const raw = instamart.extract(instamart.findCards(document)[0]);
    expect(raw.priceText).toBe('237');
    expect(raw.sizeText).toBe('30 g');
  });
});
