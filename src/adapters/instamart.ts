import { priceCardAdapter } from './price-card';

/**
 * Swiggy Instamart search (swiggy.com/instamart/search). The ₹ is drawn by CSS, so prices are bare numbers
 * ("237", with the struck MRP "249" after it). Cards are found from data-testid="item-collection-card-full",
 * which holds the picture and title; its parent also holds the size and prices.
 */
export const instamart = priceCardAdapter({
  id: 'instamart',
  hosts: ['www.swiggy.com', 'swiggy.com'],
  match: (url) => url.pathname.startsWith('/instamart'),
  isListing: (url) => url.pathname.startsWith('/instamart/search'),
  priceStyle: 'bare',
  cards: (doc) => {
    const parents = Array.from(doc.querySelectorAll('[data-testid="item-collection-card-full"]')).flatMap((e) =>
      e.parentElement ? [e.parentElement] : [],
    );
    return Array.from(new Set(parents));
  },
});
