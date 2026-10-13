import { parseQuantity } from '../core/quantity';
import { findCardsByPrice, isPriceLeaf } from './structure';
import type { SiteAdapter } from './types';
import { clean, isStruck } from './types';

const NOISE = /^(ad|add|\d+% off|best seller|notify me|sold out)$/i;
const UNAVAILABLE = /out of stock|sold out|notify me|currently unavailable/i;

/**
 * Flipkart Minutes (marketplace=HYPERLOCAL). The page is React Native Web: generated class names, no data
 * attributes, cards in rows of four. Cards are found from their prices; the first price that is not struck
 * through is the selling price, the longest text is the title, and the size line is the first short text
 * that reads as a quantity ("30 g, 50").
 */
export const flipkartMinutes: SiteAdapter = {
  id: 'flipkart-minutes',
  matches: (url) =>
    (url.hostname === 'www.flipkart.com' || url.hostname === 'flipkart.com') &&
    url.searchParams.get('marketplace') === 'HYPERLOCAL',
  isListingPage: (url) => url.pathname === '/search',
  findCards: (doc) => findCardsByPrice(doc),
  sortNode: (card) => card,
  reorder: 'dom-slots',

  extract(card) {
    const leaves = Array.from(card.querySelectorAll('*')).filter((e) => e.children.length === 0);
    const priceEl = leaves.find((e) => isPriceLeaf(e) && !isStruck(e));
    const texts = leaves.filter((e) => !isPriceLeaf(e)).map(clean).filter((t) => t && !NOISE.test(t));
    const title = texts.reduce((best, t) => (t.length > best.length ? t : best), '');
    const sizeText = texts.find((t) => t !== title && t.length <= 40 && parseQuantity(t) !== null) ?? null;
    const priceText = priceEl ? clean(priceEl) : null;
    return {
      title,
      sizeText,
      priceText,
      unitPriceText: null,
      deliveryNote: null,
      href: card.querySelector('a[href]')?.getAttribute('href') ?? null,
      sponsored: leaves.some((e) => clean(e) === 'AD'),
      outOfStock: priceText === null && UNAVAILABLE.test(clean(card)),
    };
  },
};
