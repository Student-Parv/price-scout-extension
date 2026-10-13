import { priceCardAdapter } from './price-card';

/** Flipkart Minutes (marketplace=HYPERLOCAL): React Native Web, cards in rows of four. */
export const flipkartMinutes = priceCardAdapter({
  id: 'flipkart-minutes',
  hosts: ['www.flipkart.com', 'flipkart.com'],
  match: (url) => url.searchParams.get('marketplace') === 'HYPERLOCAL',
  isListing: (url) => url.pathname === '/search',
  reorder: 'dom-slots',
});
