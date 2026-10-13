import type { SelectorAdapter } from './types';
import { clean } from './types';

const PRICE_LEAF = /^₹\s?\d[\d,]*(\.\d+)?$/;
const SOLD_OUT = /sold out|currently unavailable|out of stock/i;

export const flipkart: SelectorAdapter = {
  id: 'flipkart',
  matches: (url) => url.hostname === 'www.flipkart.com' || url.hostname === 'flipkart.com',
  isListingPage: (url) => url.pathname === '/search',
  cardSelector: 'div[data-id]',
  findCards: (doc) => Array.from(doc.querySelectorAll(flipkart.cardSelector)),
  sortNode: (card) => card,
  reorder: 'dom-slots',

  extract(card) {
    // No hashed class names: the structure is title anchor, then the size line, then rating, then prices.
    const anchor = card.querySelector('a[title]');
    const sizeRaw = clean(anchor?.nextElementSibling);
    const leaves = Array.from(card.querySelectorAll('*')).filter((e) => e.children.length === 0);
    const priceEl = leaves.find((e) => PRICE_LEAF.test(clean(e)));
    return {
      title: anchor?.getAttribute('title')?.trim() ?? '',
      sizeText: sizeRaw && sizeRaw.length <= 40 ? sizeRaw : null,
      priceText: priceEl ? clean(priceEl) : null,
      unitPriceText: null,
      deliveryNote: null,
      href: card.querySelector('a[href*="/p/"]')?.getAttribute('href') ?? null,
      sponsored: leaves.some((e) => clean(e) === 'Ad'),
      outOfStock: SOLD_OUT.test(clean(card)),
    };
  },
};
