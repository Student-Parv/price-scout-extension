import { priceCardAdapter } from './price-card';

/**
 * Zepto search (zepto.com/search?query=...). Cards carry stable data-slot-id hooks (ProductName, PackSize) and
 * a data-is-out-of-stock flag. Pack sizes such as "1 pack (48 g or 58 g)" name two weights; they stay unknown.
 */
export const zepto = priceCardAdapter({
  id: 'zepto',
  hosts: ['www.zepto.com', 'zepto.com'],
  isListing: (url) => url.pathname === '/search',
  selectors: {
    title: '[data-slot-id="ProductName"]',
    size: '[data-slot-id="PackSize"]',
    outOfStock: '[data-is-out-of-stock="true"]',
  },
});
