import { priceCardAdapter } from './price-card';

/** BigBasket search (bigbasket.com/ps/?q=...): brand, title, size ("100 g", "90 g Pouch"), price and struck MRP. */
export const bigbasket = priceCardAdapter({
  id: 'bigbasket',
  hosts: ['www.bigbasket.com', 'bigbasket.com'],
  isListing: (url) => /^\/ps\/?$/.test(url.pathname),
});
