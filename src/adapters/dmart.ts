import type { SelectorAdapter } from './types';
import { clean, hasStruck } from './types';

const PRICE = /^₹\s?\d[\d,]*(\.\d+)?$/;
const UNIT_PRICE = /^\(.*₹.*\/.*\)$/;
const UNAVAILABLE = /out of stock|sold out|notify me|currently unavailable/i;

/**
 * DMart (dmart.in). Tailwind markup: the card is a bordered box holding a /product/ link; each price is a
 * <p> with "₹" and the number in separate spans. The MRP is struck through, and the discount badge is a
 * price followed by "OFF", so the selling price is the first price that is neither. The selected variant's
 * size and unit price sit together: "50 ml" "(₹ 22.10 / 1 ml)". The printed unit price is NOT used: DMart rounds
 * it to 2 decimals (coarse for cheap per-gram items) and it disagrees with price ÷ size on some cards
 * (₹347 for 400 ml is ₹0.87/ml, printed ₹0.93/ml), while the size itself is exact.
 */
export const dmart: SelectorAdapter = {
  id: 'dmart',
  matches: (url) => url.hostname === 'www.dmart.in' || url.hostname === 'dmart.in',
  isListingPage: (url) => url.pathname === '/search',
  cardSelector: 'div[class*="border-borderGray"]',
  findCards: (doc) =>
    Array.from(doc.querySelectorAll(dmart.cardSelector)).filter((c) => c.querySelector('a[href^="/product/"]')),
  sortNode: (card) => card.closest('.MuiGrid-item') ?? card,
  reorder: 'css-order',

  extract(card) {
    const link = card.querySelector('a[href^="/product/"]');
    const priceEl = Array.from(card.querySelectorAll('p')).find(
      (p) => PRICE.test(clean(p)) && !hasStruck(p) && clean(p.nextElementSibling) !== 'OFF',
    );
    const unitEl = Array.from(card.querySelectorAll('span')).find((s) => UNIT_PRICE.test(clean(s)));
    const sizeRaw = clean(unitEl?.previousElementSibling);
    const priceText = priceEl ? clean(priceEl) : null;
    return {
      title: card.querySelector('a[aria-label]')?.getAttribute('aria-label')?.trim() ?? clean(link),
      sizeText: sizeRaw || null,
      priceText,
      unitPriceText: null,
      deliveryNote: null,
      href: link?.getAttribute('href') ?? null,
      sponsored: false,
      outOfStock: priceText === null && UNAVAILABLE.test(clean(card)),
    };
  },
};
