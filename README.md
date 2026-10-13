# Price Scout

![GitHub stars](https://img.shields.io/github/stars/Student-Parv/price-scout-extension?style=social)
![License](https://img.shields.io/github/license/Student-Parv/price-scout-extension)
![Issues](https://img.shields.io/github/issues/Student-Parv/price-scout-extension)

Sorts Amazon.in, Flipkart (including Flipkart Minutes) and DMart search results by **price per 100 g / 100 ml**, so the best value for money comes first instead of the lowest sticker price.

## What it does
- Adds a badge to every result, for example `₹747 / 100 g`. Hover it to see the maths.
- Adds a small toolbar (bottom-right): **Best value first**, **Priciest first**, **Reset**.
- Reads the size from Amazon's own unit price when it is shown, from Flipkart's size line, or from the title (`2 x 50 g`, `Pack of 3`, `1.5 L`, `100 ml + 50 ml free`).
- Cards whose size cannot be read are marked `? size` and listed after the ranked ones. Out-of-stock cards go last.
- Treats 1 ml as 1 g so liquids and solids share one ranking. Badges in the less common unit on a page are marked `≈`.
- Shows a visible delivery fee on Amazon cards (`Delivery ₹80`).
- Keeps banners and ads where they are while the products around them are re-sorted.
- Click the extension icon to try again on the current page: it injects the script if the tab was opened before the extension was installed, and shows the value on any page of a supported site that has product cards. The icon shows the number of ranked products for a few seconds.
- Runs entirely in your browser. The only permissions are `scripting` and access to amazon.in, flipkart.com and dmart.in (the same sites it already runs on). No accounts, nothing is sent anywhere.

## Supported sites
| Site | Pages | Notes |
|---|---|---|
| Amazon.in | search (`/s`) | Uses Amazon's own per-100 unit price. |
| Flipkart | search (`/search`) | |
| Flipkart Minutes | search with `marketplace=HYPERLOCAL` | Needs a serviceable delivery location, as on the site itself. |
| DMart | search (`/search`) | Computes from the exact size; DMart's printed unit price is rounded and sometimes wrong. |

On any other page of these sites that shows product cards, click the extension icon to show the badges.

**Not supported yet:** Blinkit, Zepto, Swiggy Instamart, Amazon Now, BigBasket, JioMart, Nykaa, Tira, 1mg, PharmEasy. Several of these block automated browsers, so an adapter has to be built from a page saved in a real browser: see "Adding a site" in `CONTRIBUTING.md`.

## Install (Chrome, Brave, Edge)
1. `npm ci && npm run build`
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose the `dist` folder.

## Develop
- `npm test`: unit and fixture tests (parser, adapters, reordering, controller).
- `npm run build`: type-check and bundle to `dist/`.
- `npm run smoke`: loads the bundle on live Amazon.in and Flipkart pages with Brave and checks sort, reverse and reset.

Design: `docs/superpowers/specs/`. Plans: `docs/superpowers/plans/`.

## Limitations
- Mass and volume are compared as if 1 ml = 1 g, which is wrong for oils, honey and gels.
- Only the cards on the current page are ranked; use the site's page links to see more.
- Site markup changes can break an adapter. The saved pages in `tests/fixtures` show what each adapter expects.
- `mg` is ignored as a size (it is a dose, not a pack size).

MIT licensed.
