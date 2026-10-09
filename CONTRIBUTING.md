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
