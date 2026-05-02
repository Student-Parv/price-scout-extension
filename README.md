# Value Sorter (IN)

Chrome extension (Manifest V3) that parses Amazon.in and Flipkart search results and sorts by price per 100g / 100ml based on Amazon/Flipkart's own per-unit values.

Install (developer mode):

1. Open `chrome://extensions/`
2. Toggle Developer mode ON
3. Click "Load unpacked" and select this folder

Usage:
- Open an Amazon.in or Flipkart search results page. A yellow "Sort by value / unit" button appears at top-right.
- Click it to compute per-100 values and reorder results (found items first, not-found at bottom).

Supported sites:
- amazon.in/s?k=...
- flipkart.com/search?q=...

Notes:
- Extracts per-100g or per-100ml directly from product cards
- Items are sorted lowest price-per-100 first (best value)
- Items without per-100 pricing are marked "not found"
