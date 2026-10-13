# Contributing to Price Scout

Thanks for wanting to help — contributions, issues and feedback make this project better.

How to contribute
- Fork the repo and create a feature branch.
- Open a PR describing your change and link any related issue.
- Keep changes small and focused; include tests where practical.

Community guidelines
- Be respectful and collaborative.
- Follow the Code of Conduct in `CODE_OF_CONDUCT.md`.

Development
- `npm ci`, then `npm test` and `npm run build`.
- Load `dist/` as an unpacked extension (see README).
- A new site is one file in `src/adapters/` plus a trimmed saved page in `tests/fixtures/<site>/` (`node scripts/trim-fixture.mjs saved.html tests/fixtures/<site>/<query>.html`) and a test next to the existing adapter tests.
- Parser changes need a row in `tests/core/quantity.test.ts`.
- `npm run smoke` checks the built bundle on live Amazon.in and Flipkart pages with Brave.
- Sites that block headless browsers (Blinkit, Zepto, Instamart and BigBasket answered "access denied", 429 or 403 to a headless Brave but not to a normal headed one): start a normal Brave with a debugging port and a throwaway profile folder (`--remote-debugging-port=9333 --user-data-dir=<folder>`), attach with `playwright-core`'s `chromium.connectOverCDP`, and capture pages from it; or open the page in your own browser and run `scripts/capture-page.js` in the console. Check the saved file for personal details, then trim it into `tests/fixtures/<site>/` with `scripts/trim-fixture.mjs`. Do not hammer a site: several began to rate-limit after a few dozen requests.
- Most quick-commerce sites share one card shape: use `priceCardAdapter` in `src/adapters/price-card.ts` (a config of hosts, listing path and optional `selectors` hooks) before writing a new adapter.
- Generated class names (React Native Web, Tailwind): use `findCardsByPrice` in `src/adapters/structure.ts` to find cards from their prices, and read each field from structure and text, not class names.
