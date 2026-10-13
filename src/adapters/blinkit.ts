import { priceCardAdapter } from './price-card';

/** Blinkit search (blinkit.com/s/?q=...): Tailwind markup, the size shares an element with a dropdown icon. */
export const blinkit = priceCardAdapter({
  id: 'blinkit',
  hosts: ['blinkit.com', 'www.blinkit.com'],
  isListing: (url) => /^\/s\/?$/.test(url.pathname),
});
