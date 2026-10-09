# Unit-price sorter: design

Date: 2026-10-09
Status: draft, awaiting review
Repo: `price-scout-extension` (evolve in place; history, licence and templates kept)

## 1. Goal

Let a shopper rank e-commerce search results by **price per 100 ml / 100 g** instead of by sticker price, so the best value-for-money product comes first. It must work for anything sold by weight or volume (sunscreen, shampoo, chips, flour, ghee, and so on), on the Indian sites listed in section 3.

Success criteria:

1. On Amazon and Flipkart search pages for at least five test queries (sunscreen, shampoo, chips, atta, ghee), the on-page order matches a hand-calculated ₹/100 ranking.
2. The quantity parser is correct on at least 95% of a labelled corpus of real titles, and the remaining cases come out as **unknown**, never as a silently wrong number.
3. Cards loaded later (scroll, "load more", client-side navigation) get a badge and join the current sort without the user clicking again.

Non-goals (v1): price history, price alerts, cross-site comparison, product-page UI, per-piece or per-tablet pricing, any account or backend.

## 2. What exists today (v0.3.0)

One plain-JS `content.js` (about 14 KB), a popup, a stylesheet, MV3 with no permissions, no build step and no tests. It has a per-site selector table, a unit table, `N x Q unit` pack parsing, a badge and an `appendChild` reorder. A full list of problems found is in the review thread; the ones this design fixes:

- Parser misses `gm`, `gms`, `oz`, `mg`, `lb` and plurals (`litres`, `ltrs`, `kgs`); no "pack of N", no `Q unit x N`; ranges and variant lists give wrong values.
- `parsePrice` concatenates all digits, so a node holding selling price and MRP becomes one huge number.
- Reorder moves cards to the end of their parent and hand-moves SPA-owned nodes.
- Sort is one-shot; new cards never join; non-Amazon/Flipkart sites are scanned once.
- README claims features (history, alerts, export) that do not exist.

## 3. Sites

All are in scope, built as independent adapters. Each ships only after it is verified against the live DOM (selectors in the old config are unverified guesses).

| Tier | Sites | Notes |
|---|---|---|
| 1 | Amazon, Flipkart | Highest traffic; first end-to-end target. |
| 2 | Nykaa, Tira, 1mg, PharmEasy, BigBasket | Beauty, pharmacy, grocery. |
| 3 | Zepto, Blinkit, Swiggy Instamart, JioMart, DMart | Quick-commerce: SPA, pincode-gated, fees visible mostly at cart. |
| 4 | Myntra, Meesho, Snapdeal | Carried over from the old repo; mostly non-weight/volume goods, lowest priority. |

Amazon scope in v1 is **amazon.in only** (₹ pricing, as in the existing repo); amazon.com is out of scope.

## 4. Architecture

TypeScript + Vite, MV3, runs in Chrome and Brave.

```
src/
  core/        pure, no DOM; unit-tested
    types.ts       Quantity, UnitPrice, RawCard
    units.ts       unit table + conversions
    quantity.ts    parseQuantity(text) -> Quantity | Unknown
    price.ts       parsePrice(text) -> number | null
    rank.ts        computeUnitPrice, sortCards
  adapters/    one module per site, implements SiteAdapter
  content/     DOM-touching code
    main.ts        boot, adapter selection
    scan.ts        find cards, extract, compute, badge
    observer.ts    MutationObserver + URL-change detection
    badge.ts       Shadow-DOM badge
    toolbar.ts     Shadow-DOM sort toolbar
    reorder.ts     CSS-order or in-place DOM reorder
    fallback.ts    product-page quantity lookup + cache
tests/
  core/  adapters/  fixtures/<site>/*.html  corpus/*.json
```

Dependency direction is one-way: `content` and `adapters` depend on `core`; `core` depends on nothing. An adapter can be rewritten without touching the parser, and the parser can be tested without a browser.

### Adapter interface

```ts
interface SiteAdapter {
  id: string;
  matches(url: URL): boolean;
  isListingPage(url: URL, doc: Document): boolean;
  cardSelector: string;
  container(doc: Document): HTMLElement | null;
  extract(card: HTMLElement): RawCard;      // title, price node text, card text, href, flags
  sortNode?(card: HTMLElement): HTMLElement; // wrapper to reorder, if not the card itself
  deliveryNote?(card: HTMLElement): string | null;
  reorder: 'css-order' | 'dom-move';
}
```

`RawCard` carries `title`, `priceText`, `text` (whole card), `href`, and flags `sponsored` and `outOfStock`.

## 5. Data flow

1. `main` picks the adapter for the URL and stops if `isListingPage` is false.
2. `observer` watches the container (falling back to `body`) with a debounced `MutationObserver` (about 250 ms) and re-checks `location.href` on each tick and on `popstate`, so client-side navigation re-initialises.
3. `scan` handles only cards not yet seen (tracked with a `WeakSet`, not by re-parsing everything on every scroll).
4. Per card: `adapter.extract`, then `parsePrice`, then `parseQuantity` on title, then on card text, then (if still unknown and under budget) `fallback` fetches the product page.
5. `computeUnitPrice` gives ₹ per 100 of the canonical unit; `badge` renders it.
6. If a sort is active, the card is placed into the current order. The toolbar button toggles ascending, descending and reset.

## 6. Quantity parser

Input: free text (title, then card text). Output: `{ value, dim, confidence, source, explanation }` or `Unknown`.

- `value` is canonical: grams for mass, millilitres for volume. `dim` is `mass` or `volume`.
- `explanation` is the human-readable maths shown in the badge tooltip, for example `2 × 100 g = 200 g`.

Units recognised (case-insensitive, with optional plural and trailing dot):

| Canonical | Accepted |
|---|---|
| g | g, gm, gms, gram, grams |
| kg (×1000 g) | kg, kgs, kilo, kilogram(s) |
| mg (÷1000 g) | mg |
| lb (×453.592 g) | lb, lbs |
| oz (×28.3495 g) | oz, when not preceded by `fl` |
| ml | ml, millilitre(s), milliliter(s) |
| l (×1000 ml) | l, ltr, ltrs, litre(s), liter(s) |
| fl oz (×29.5735 ml) | fl oz, fl. oz |

Patterns, tried in this order (first confident match wins):

1. `N x Q unit` or `N × Q unit` → N·Q.
2. `Q unit x N` → Q·N (the old code read this as a single Q).
3. `Q unit` with `pack of N` / `N pack` / `set of N` / `N pcs` nearby → N·Q, confidence medium, and the tooltip shows the interpretation.
4. `Q1 unit + Q2 unit free` (same unit) → sum, confidence medium.
5. Single `Q unit` → Q.

Rejected as **Unknown** (never guessed): ranges (`50-100 ml`), more than one different size in the same string without a pack or "+" pattern (variant lists, combos of different products), a bare number with no unit, and a result of zero or above a sanity cap.

Whether "Pack of 2, 100 g" means 200 g or 100 g each differs between sites. The default is to multiply and show the tooltip. This is validated against real listings during the Amazon phase and the rule is adjusted per adapter if needed.

Confidence: `high` = parsed from title or card text with an unambiguous pattern; `medium` = pack/"+" interpretation or product-page spec; `low` is not shown as a number (it becomes Unknown).

## 7. Price extraction

- Each adapter points at the **selling-price node**. `parsePrice` is called on one node's text only and never concatenates text from several nodes.
- Struck-through nodes (`del`, `s`, `[class*=mrp]`, or computed `text-decoration: line-through`) are excluded.
- Text containing `off`, `save`, `coupon`, `delivery`, `fee`, or a second ₹ amount is rejected as a price source.
- Indian formatting (`₹1,29,999.00`) is handled; a trailing `.` is tolerated.
- The generic "first ₹ anywhere" fallback of the old code is removed. If an adapter cannot find a price node, the card is Unknown.

## 8. Units and ranking

- Per your decision, **1 ml = 1 g**: mass and volume are ranked together in one list.
- A card whose dimension differs from the page's dominant dimension (the one with more cards) is marked with `≈` in its badge, for example `≈ ₹450 / 100 ml` on a page of grams. The original unit is always shown.
- Known risk, accepted: density differs for oils, honey, gels and similar, so cross-dimension ranking can mislead. The `≈` marker is the only mitigation in v1. (The old code ranked mass and volume separately.)
- Order: known unit price ascending (or descending), then unknown-quantity cards, then out-of-stock cards. Sponsored cards are ranked normally and tagged **Ad**.

## 9. Reordering

- `css-order` (preferred): set `style.order` on each card's `sortNode` when the container is a flex or grid. No nodes are detached, so framework re-renders are less likely to undo it.
- `dom-move` (fallback): re-insert the sorted nodes at the position of the first card, **not** at the end of the parent. This fixes the old behaviour of pushing cards past banners and pagination.
- Reset removes the `order` styles or restores recorded original positions.
- Behaviour on React-style SPAs is verified per adapter; an adapter that cannot be made stable stays badge-only and the toolbar says so.

## 10. Product-page fallback and cache

Used only when title and card text give no quantity.

- Fetch runs **from the content script** (same origin as the page), so the extension needs no `host_permissions` and no background worker for it.
- Parse the response HTML with `DOMParser` for the spec table / variant text, then run `parseQuantity`.
- Limits: at most 2 concurrent requests, a jittered delay between requests, a per-page cap (about 20), and a hard stop for the rest of the session on HTTP 429 or when the response looks like a CAPTCHA or login page.
- Results are cached in `chrome.storage.local` by canonical product URL with a TTL, which is why the manifest requests `storage` and nothing else.
- Cards still unknown after the fallback show a muted `?` badge and sort to the bottom.

## 11. UI

- **Toolbar**: injected on every supported listing page, fixed position, inside a Shadow DOM so site CSS cannot break it. Shows sort direction, reset, and counts (`ranked / unknown`).
- **Badge**: Shadow-DOM element per card, `₹450 / 100 ml`, tooltip with the maths and source. Unknown cards show a muted `?` instead of the old `— no size` text on every card.
- **Delivery note**: shown only when the fee is visible on the card or page (`Delivery ₹30`). Where fees appear only at cart (common on quick-commerce), the badge carries a generic "fees may apply" hint.
- **Popup**: removed in v1; the toolbar replaces it.

## 12. Decisions recorded

1. **Amazon domain**: amazon.in only.
2. **Popup**: removed; the injected toolbar is the only UI.
3. **Commit identity**: GitHub account `Student-Parv` with its noreply address (exact address supplied by the repo owner before the first commit).

## 13. Testing

- **Parser corpus**: about 200 real titles per category (sunscreen, shampoo, chips, flour, oil, beverages, supplements) collected from live pages, each with a hand-labelled expected quantity or `Unknown`. Vitest.
- **Adapter fixtures**: saved listing HTML per site, asserting the card count, price and title extraction.
- **Live smoke**: Playwright against each site per phase, plus a manual checklist (sort, new cards after scroll, SPA navigation, reset).
- Success criteria in section 1 are checked at the end of the Amazon phase, then per site.

## 14. Build order

0. Branch, TS + Vite scaffold, Vitest, `core` (units, quantity, price, rank) with the corpus. Legacy files stay until phase 1 replaces them.
1. Content layer + Amazon adapter end to end (badge, toolbar, reorder, observer). Remove legacy `content.js`, popup and stylesheet.
2. Flipkart.
3. Product-page fallback and cache.
4. Tier 2 sites, one at a time.
5. Tier 3 quick-commerce sites.
6. Tier 4 sites (Myntra, Meesho, Snapdeal).
7. README and CONTRIBUTING rewritten to describe only what exists.

Each phase is independently releasable.

## 15. Risks

- **Selector churn** on all sites; adapters are small and isolated, and fixtures catch regressions.
- **Anti-bot or CAPTCHA** if fallback fetches are too aggressive; mitigated by the limits and hard stop in section 10.
- **Quick-commerce** pages depend on pincode and render late; they are the last tier on purpose.
- **Scope**: fifteen sites is a lot. The tiering lets us stop at any tier with a working product.
- **ToS**: the extension only reads pages the user is already viewing, plus rate-limited same-site fetches; no data leaves the browser.

## 16. Changes from the design discussed in chat

- Product-page fetch moves from a background worker to the content script (smaller permission surface).
- Reorder `dom-move` fallback re-inserts at the first card's position (fixes the old end-of-parent behaviour).
- The popup is removed (confirmed).
