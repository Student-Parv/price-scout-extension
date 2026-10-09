import type { SiteAdapter } from './types';
import { clean } from './types';

const DELIVERY_RE = /₹\s*([\d,]+)\s+delivery/i;

export const amazon: SiteAdapter = {
  id: 'amazon',
  matches: (url) => url.hostname === 'www.amazon.in' || url.hostname === 'amazon.in',
  isListingPage: (url) => url.pathname === '/s',
  cardSelector: '[data-component-type="s-search-result"][data-asin]:not([data-asin=""])',
  sortNode: (card) => card,
  reorder: 'css-order',

  extract(card) {
    const title = clean(card.querySelector('[data-cy="title-recipe"] a h2') ?? card.querySelector('h2'));
    const recipe = card.querySelector('[data-cy="price-recipe"]');
    const sell = recipe?.querySelector('.a-price:not(.a-text-price) .a-offscreen');
    const unitEl = recipe
      ? Array.from(recipe.querySelectorAll('span')).find((s) => /^\(.*\/.*\)$/.test(clean(s)))
      : undefined;
    const delivery = DELIVERY_RE.exec(clean(card));
    const priceText = sell ? clean(sell) : null;
    return {
      title,
      sizeText: null,
      priceText,
      unitPriceText: unitEl ? clean(unitEl) : null,
      deliveryNote: delivery ? `Delivery ₹${delivery[1]}` : null,
      href: card.querySelector('[data-cy="title-recipe"] a')?.getAttribute('href') ?? null,
      // Best effort: no sponsored card appeared in the six probed queries.
      sponsored: !!card.querySelector('.puis-sponsored-label-text, [data-component-type="sp-sponsored-result"]'),
      outOfStock: priceText === null && /currently unavailable/i.test(clean(card)),
    };
  },
};
