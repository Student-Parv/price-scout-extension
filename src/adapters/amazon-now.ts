import { priceCardAdapter } from './price-card';

/**
 * Amazon Now (amazon.in/tez/browse/search?searchKeyword=...). UNVERIFIED: the page only shows products to a
 * signed-in account with a deliverable address, so its markup has not been seen yet. This uses the shared
 * price-card logic that works on Zepto, Blinkit, BigBasket, Instamart and Flipkart Minutes. If it misreads
 * the page, capture it with scripts/capture-page.js while signed in and build fixtures from that.
 */
export const amazonNow = priceCardAdapter({
  id: 'amazon-now',
  hosts: ['www.amazon.in', 'amazon.in'],
  match: (url) => url.pathname.startsWith('/tez'),
  isListing: (url) => url.pathname.startsWith('/tez/browse/search'),
});
