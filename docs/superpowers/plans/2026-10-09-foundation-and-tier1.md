# Price Scout Foundation + Tier 1 (Amazon, Flipkart) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-file prototype with a TypeScript/Vite MV3 build whose pure core (quantity parser, unit price, ranking) is unit-tested, and ship a loadable extension that badges and re-sorts Amazon.in and Flipkart search results by ₹ per 100 g / 100 ml.

**Architecture:** `src/core` is pure TypeScript with no DOM. `src/adapters` has one module per site that turns a result card into a `RawCard`. `src/content` owns everything that touches the page: badges, toolbar, reordering, and a throttled `MutationObserver` loop. One content script (`dist/content.js`, IIFE) holds all adapters and picks one by URL at runtime.

**Tech Stack:** TypeScript 5, Vite (library mode, IIFE), Vitest + jsdom, playwright-core (live smoke only, drives the installed Brave). No runtime dependencies, no extension permissions.

**Spec:** `docs/superpowers/specs/2026-10-09-unit-price-sorter-design.md` (amended in Task 1 with findings from live pages).

## Global Constraints

- Manifest V3, `"permissions": []`, no `host_permissions`, no background worker.
- Canonical units: grams for mass, millilitres for volume. 1 ml = 1 g for ranking; a badge on the non-dominant dimension is prefixed `≈`.
- Unit table: g, gm, gms, gram(s); kg, kgs, kilo(s), kilogram(s); lb(s); oz; ml, millilitre(s), milliliter(s); l, ltr, ltrs, litre(s), liter(s); fl oz. `mg` is **not** a size unit (it is dosage).
- Anything ambiguous (ranges, several different sizes, no unit) is `Unknown`, never guessed.
- Order: ranked, then unknown, then unavailable. Ties keep original order.
- Selling price is read from one node's text only, strict format (`₹1,29,999.00`); never concatenate nodes.
- Badges and toolbar render inside Shadow DOM.
- Node commands that install packages use `npm_config_cache=/mnt/data/npm-cache` (root disk is nearly full). Nothing is stored outside `/mnt/data`.
- Commits end with the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Out of scope for this plan: product-page fetch fallback, storage/cache, tiers 2–4 sites. They get their own plans.

## File Structure

```
package.json  tsconfig.json  vite.config.ts
public/manifest.json                    copied to dist/ by Vite
src/core/types.ts                       shared types
src/core/units.ts                       unit table + number/unit regex fragments
src/core/quantity.ts                    parseQuantity(text)
src/core/price.ts                       parsePrice(text)
src/core/unitprice.ts                   parseUnitPrice, quantityFromUnitPrice
src/core/analyze.ts                     analyzeCard(raw) -> CardAnalysis
src/core/format.ts                      formatPer100
src/core/rank.ts                        sortOrder, dominantDim
src/adapters/types.ts                   SiteAdapter
src/adapters/amazon.ts  flipkart.ts  index.ts
src/content/reorder.ts                  css-order and dom-slots reorderers
src/content/badge.ts  toolbar.ts        Shadow-DOM UI
src/content/controller.ts               ListingController (scan, badge, sort)
src/content/main.ts                     boot, URL-change loop
tests/helpers.ts  tests/fixtures/{amazon,flipkart}/*.html
tests/core/*.test.ts  tests/adapters/*.test.ts  tests/content/*.test.ts
scripts/trim-fixture.mjs  scripts/smoke.mjs
```

Legacy `content.js`, `popup.html`, `popup.js`, `styles.css` are deleted in Task 1 (their ideas live on in the new modules).

---

### Task 1: Scaffold, spec amendments, remove legacy files

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `public/manifest.json`, `src/content/main.ts` (stub), `tests/scaffold.test.ts`
- Modify: `docs/superpowers/specs/2026-10-09-unit-price-sorter-design.md`
- Delete: `content.js`, `popup.html`, `popup.js`, `styles.css`

**Interfaces:**
- Produces: `npm run build` → `dist/content.js` + `dist/manifest.json`; `npm test`; `npm run typecheck`.

- [ ] **Step 1: Write package.json**

```json
{
  "name": "price-scout-extension",
  "version": "0.4.0",
  "private": true,
  "type": "module",
  "description": "Sort e-commerce listings by price per 100 g / 100 ml.",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "smoke": "node scripts/smoke.mjs"
  }
}
```

- [ ] **Step 2: Install dev dependencies**

Run:
```bash
cd /mnt/data/Tools/price-scout-extension
npm_config_cache=/mnt/data/npm-cache npm install -D typescript vite vitest jsdom @types/node playwright-core
```
Expected: `added N packages`, `node_modules/` created (ignored by `.gitignore`).

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": ["node"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

- [ ] **Step 4: Write vite.config.ts**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    minify: false,
    lib: {
      entry: 'src/content/main.ts',
      name: 'PriceScout',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Write public/manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Price Scout",
  "version": "0.4.0",
  "description": "Rank Amazon.in and Flipkart search results by price per 100 g / 100 ml.",
  "content_scripts": [
    {
      "matches": ["*://www.amazon.in/*", "*://www.flipkart.com/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "permissions": []
}
```

- [ ] **Step 6: Write the stub entry and a scaffold test (failing first)**

`tests/scaffold.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

describe('scaffold', () => {
  it('manifest is MV3 with no permissions', () => {
    const m = JSON.parse(readFileSync('public/manifest.json', 'utf8'));
    expect(m.manifest_version).toBe(3);
    expect(m.permissions).toEqual([]);
    expect(m.host_permissions).toBeUndefined();
  });
  it('legacy prototype files are gone', () => {
    for (const f of ['content.js', 'popup.html', 'popup.js', 'styles.css']) {
      expect(existsSync(f)).toBe(false);
    }
  });
});
```

`src/content/main.ts` (stub, replaced in Task 8):
```ts
export {};
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — "legacy prototype files are gone" (the four files still exist).

- [ ] **Step 8: Delete legacy files**

Run: `git rm -q content.js popup.html popup.js styles.css`

- [ ] **Step 9: Amend the spec with verified findings**

Apply these edits to `docs/superpowers/specs/2026-10-09-unit-price-sorter-design.md`:

1. Section 6 (parser): replace the unit table row `mg (÷1000 g) | mg` with the sentence "`mg` is not a size unit (it is a dose, e.g. `500 mg` tablets) and is ignored." Add a new first source before the patterns: "**Site unit price.** Amazon.in prints `(₹746.67/100 g)` on ~95% of priced cards (verified 2026-10-09 on six queries). When present, quantity = selling price ÷ unit price × per-amount. It wins over title text; if they disagree by more than 3% the badge tooltip shows both."
2. Section 5 step 4 and section 6 input: replace "title, then card text" with "site unit price, then the site's dedicated size text (Flipkart `30 g`, `4 x 102 g`), then the title". Add: "Whole-card text is not parsed: it contains the unit-price string `/100 g`, which would be misread as a 100 g pack."
3. Section 9: rename the fallback `dom-move` to `dom-slots`: "Flipkart renders results as rows of four cards (`div[data-id]` children of a flex row), so CSS `order` cannot reorder across rows. `dom-slots` records each card's slot, then fills the slots with the sorted cards, which works for any container shape." State that Amazon's `.s-main-slot` is `display: grid`, so `css-order` is used there, and non-card children (widgets) get odd `order` values so they keep their position between sorted cards.
4. Section 10: add a note "Not in plan 1. Amazon unit-price coverage was 45/48, 39/39, 36/36, 48/48, 45/46 and 48/48 priced cards across six queries, and Flipkart showed a size line on 40/40 cards, so the fallback is deferred to a later plan."
5. Section 4/11: add "Flipkart pagination is by page links (`page=2`), not infinite scroll: scrolling did not add cards (40 before and after). Amazon is likewise paginated. The observer still handles late renders and client-side navigation."
6. Section 11: "Delivery note: implemented for Amazon (`₹80 delivery` is visible on cards); Flipkart cards show none."
7. Section 12: add "Commit identity resolved: `Parv Lunia <114015466+Student-Parv@users.noreply.github.com>`."

- [ ] **Step 10: Run tests, typecheck, build**

Run: `npm test && npm run typecheck && npm run build && ls dist`
Expected: tests PASS (2), typecheck clean, `dist` contains `content.js` and `manifest.json`.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "build: TypeScript + Vite MV3 scaffold; drop prototype files; amend spec" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Units and quantity parser

**Files:**
- Create: `src/core/types.ts`, `src/core/units.ts`, `src/core/quantity.ts`
- Test: `tests/core/quantity.test.ts`

**Interfaces:**
- Produces:
  - `type Dim = 'mass' | 'volume'`
  - `interface Quantity { value: number; dim: Dim; confidence: 'high' | 'medium'; source: 'site-unit-price' | 'text' | 'pack' | 'bonus'; explanation: string }`
  - `parseQuantity(input: string | null | undefined): Quantity | null` — `value` is grams or millilitres.
  - From `units.ts`: `UNITS`, `UNIT_PATTERN`, `NUM_PATTERN`, `toNumber(s)`, `lookupUnit(token): UnitDef | null`, `canonical(amount, unit)`, `formatAmount(n)`; `UnitDef = { dim: Dim; factor: number; label: 'g' | 'ml' }`.

- [ ] **Step 1: Write types.ts**

```ts
export type Dim = 'mass' | 'volume';
export type Confidence = 'high' | 'medium';
export type QuantitySource = 'site-unit-price' | 'text' | 'pack' | 'bonus';

export interface Quantity {
  /** Canonical amount: grams for mass, millilitres for volume. */
  value: number;
  dim: Dim;
  confidence: Confidence;
  source: QuantitySource;
  /** Human-readable maths, shown in the badge tooltip. */
  explanation: string;
}

/** What an adapter reads off one result card. All text is already trimmed. */
export interface RawCard {
  title: string;
  /** Dedicated size line when the site has one (Flipkart: "4 x 102 g"). */
  sizeText: string | null;
  /** Text of the selling-price node only, e.g. "₹224". */
  priceText: string | null;
  /** The site's own unit price, e.g. "(₹746.67₹746.67/100 g)". */
  unitPriceText: string | null;
  deliveryNote: string | null;
  href: string | null;
  sponsored: boolean;
  outOfStock: boolean;
}

export type CardState = 'ranked' | 'unknown' | 'unavailable';

export interface CardAnalysis {
  state: CardState;
  price: number | null;
  quantity: Quantity | null;
  /** ₹ per 100 g (mass) or per 100 ml (volume). */
  per100: number | null;
  /** Extra tooltip line, e.g. when title and site unit price disagree. */
  note: string | null;
}
```

- [ ] **Step 2: Write the failing test**

`tests/core/quantity.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseQuantity } from '../../src/core/quantity';

type Case = [title: string, value: number, dim: 'mass' | 'volume'];

const KNOWN: Case[] = [
  ['Minimalist Sunscreen SPF 50 PA++++ with Niacinamide | Face Sunscreen for Men & Women | 30gm', 30, 'mass'],
  ['Pilgrim Australian Tea Tree Non-Drying Anti-Dandruff Shampoo - 200ml', 200, 'volume'],
  ['Dove Intense Repair Shampoo 1 L|| Repairs Dry and Damaged', 1000, 'volume'],
  ['TRESemmé Keratin Smooth Shampoo 340 ML | 72H Frizz Control', 340, 'volume'],
  ['Natureland Organics Whole Wheat Flour Bag, 5 kg', 5000, 'mass'],
  ['Patanjali Traditional Whole Wheat Chakki Atta 5kg - 100% Atta 0% Maida', 5000, 'mass'],
  ['Original | Potato Chips | On-the-Go Can | 141g', 141, 'mass'],
  ['Fortune Sunlite Refined Sunflower Oil 1 Litre Pouch', 1000, 'volume'],
  ['Basmati Rice 5 Kg', 5000, 'mass'],
  ['Coca-Cola 2.25 L', 2250, 'volume'],
  ['Groundnut Oil 1,000 ml', 1000, 'volume'],
  ['Ghee 500 ml (0.5 L)', 500, 'volume'],
  ['Protein Powder 2lbs (907g)', 907.18, 'mass'],
  ['Peanut Butter 1 lb', 453.592, 'mass'],
  ['Honey 12 fl oz', 354.882, 'volume'],
  ['Dairy Milk 4×50g', 200, 'mass'],
  ['Pepsi 6 x 250 ml', 1500, 'volume'],
  ['Garnier Face Wash 2 x 100 ml', 200, 'volume'],
  ['Dettol Handwash Refill 750ml x 2', 1500, 'volume'],
  ['Lays 52g x 6 packs', 312, 'mass'],
  ['Mamaearth Face Wash Pack of 2, 100 g', 200, 'mass'],
  ['Himalaya Neem Face Wash 150ml (Pack of 3)', 450, 'volume'],
  ['Lakme Serum 100ml + 50ml free', 150, 'volume'],
  ['Tide Detergent 2 kg + 500 g free', 2500, 'mass'],
  ['Surf Excel 1 kg (Pack of 1)', 1000, 'mass'],
  ['Soap 3 x 75 g Pack of 3', 225, 'mass'],
  ['4 x 26.75 g', 107, 'mass'],
  ['1.2 L', 1200, 'volume'],
  ['SPF 50 - 100 ml', 100, 'volume'],
  ['Shampoo 200 millilitres', 200, 'volume'],
  ['Oil 2 ltrs', 2000, 'volume'],
  ['Rice 10 kgs', 10000, 'mass'],
  ['Atta 500 gms', 500, 'mass'],
  ['Atta 500 gm', 500, 'mass'],
];

const UNKNOWN: string[] = [
  "Lay’s Hot and Sweet Chilli, 52.9g/ 48g /58g (Weight may vary)",
  'Lays Potato Chips - Classic Salted, 80gm/82gm (Weight May Vary)',
  'Combo of Shampoo 200ml and Conditioner 180ml',
  'Sunscreen 50-100 ml',
  'Sunscreen 50ml - 100ml',
  'Vitamin C 500mg 60 tablets',
  'SPF 50 PA++++ Sunscreen',
  'Pringles',
  '500',
  '',
];

describe('parseQuantity', () => {
  it.each(KNOWN)('%s', (title, value, dim) => {
    const q = parseQuantity(title);
    expect(q).not.toBeNull();
    expect(q!.dim).toBe(dim);
    expect(q!.value).toBeCloseTo(value, 2);
  });

  it.each(UNKNOWN)('is unknown for %j', (title) => {
    expect(parseQuantity(title)).toBeNull();
  });

  it('handles null and undefined', () => {
    expect(parseQuantity(null)).toBeNull();
    expect(parseQuantity(undefined)).toBeNull();
  });

  it('marks plain sizes high confidence and pack/bonus medium', () => {
    expect(parseQuantity('Shampoo 200ml')!.confidence).toBe('high');
    expect(parseQuantity('Shampoo 200ml')!.source).toBe('text');
    expect(parseQuantity('4 x 50 g')!.confidence).toBe('high');
    expect(parseQuantity('4 x 50 g')!.source).toBe('pack');
    expect(parseQuantity('Wash 100 g Pack of 3')!.confidence).toBe('medium');
    expect(parseQuantity('Serum 100ml + 50ml free')!.source).toBe('bonus');
  });

  it('explains the maths for packs', () => {
    expect(parseQuantity('Pepsi 6 x 250 ml')!.explanation).toBe('6 × 250 ml = 1500 ml');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/core/quantity.test.ts`
Expected: FAIL — cannot resolve `../../src/core/quantity`.

- [ ] **Step 4: Write units.ts**

```ts
import type { Dim } from './types';

export interface UnitDef {
  dim: Dim;
  /** Multiply an amount in this unit by `factor` to get grams or millilitres. */
  factor: number;
  label: 'g' | 'ml';
}

const mass = (factor: number): UnitDef => ({ dim: 'mass', factor, label: 'g' });
const volume = (factor: number): UnitDef => ({ dim: 'volume', factor, label: 'ml' });

/** `mg` is deliberately absent: on listings it is a dose, not a pack size. */
export const UNITS: Record<string, UnitDef> = {
  g: mass(1), gm: mass(1), gms: mass(1), gram: mass(1), grams: mass(1),
  kg: mass(1000), kgs: mass(1000), kilo: mass(1000), kilos: mass(1000),
  kilogram: mass(1000), kilograms: mass(1000),
  lb: mass(453.592), lbs: mass(453.592), oz: mass(28.3495),
  ml: volume(1), millilitre: volume(1), millilitres: volume(1),
  milliliter: volume(1), milliliters: volume(1),
  l: volume(1000), ltr: volume(1000), ltrs: volume(1000),
  litre: volume(1000), litres: volume(1000), liter: volume(1000), liters: volume(1000),
  floz: volume(29.5735),
};

/** Alternation of every unit token, longest first so `kgs` wins over `kg`. */
export const UNIT_PATTERN = Object.keys(UNITS)
  .sort((a, b) => b.length - a.length)
  .join('|');

/** 1,000 / 1,29,999 / 34.5 / 500 */
export const NUM_PATTERN = '(?:\\d{1,3}(?:,\\d{2,3})+|\\d+)(?:\\.\\d+)?';

export function toNumber(raw: string): number {
  return parseFloat(raw.replace(/,/g, ''));
}

export function lookupUnit(token: string): UnitDef | null {
  return UNITS[token.toLowerCase()] ?? null;
}

export function canonical(amount: number, unit: UnitDef): number {
  return amount * unit.factor;
}

export function formatAmount(value: number): string {
  return String(Math.round(value * 100) / 100);
}
```

- [ ] **Step 5: Write quantity.ts**

```ts
import type { Dim, Quantity } from './types';
import { NUM_PATTERN, UNIT_PATTERN, canonical, formatAmount, lookupUnit, toNumber } from './units';

const BEFORE = '(?<![\\w.,])';
const QTY = `(${NUM_PATTERN})\\s*(${UNIT_PATTERN})\\b`;

const QTY_RE = new RegExp(BEFORE + QTY, 'gi');
/** 4 x 26.75 g */
const COUNT_FIRST_RE = new RegExp(`${BEFORE}(\\d{1,3})\\s*x\\s*${QTY}`, 'i');
/** 26.75 g x 4 */
const COUNT_AFTER_RE = new RegExp(
  `${BEFORE}${QTY}\\s*x\\s*(\\d{1,3})\\b(?!\\s*(?:${UNIT_PATTERN})\\b)`,
  'i',
);
/** 100 ml + 50 ml free */
const BONUS_RE = new RegExp(`${BEFORE}${QTY}\\s*\\+\\s*${QTY}`, 'i');
/** 50-100 ml, 50 ml - 100 ml (a bare "50 - 100 ml" with spaces is not treated as a range) */
const RANGE_RE = new RegExp(
  `${BEFORE}(?:${NUM_PATTERN}\\s*(?:${UNIT_PATTERN})\\s*-\\s*${NUM_PATTERN}\\s*(?:${UNIT_PATTERN})\\b` +
    `|${NUM_PATTERN}-${NUM_PATTERN}\\s*(?:${UNIT_PATTERN})\\b)`,
  'i',
);
const PACK_RE =
  /\b(?:pack of|set of|combo of)\s*(\d{1,3})\b|\b(\d{1,3})\s*(?:-\s*)?(?:pack|packs|pcs|pieces|units|count)\b/i;

interface Part {
  value: number;
  dim: Dim;
  raw: string;
}

function normalise(s: string): string {
  return s
    .replace(/[×✕✖]/g, 'x')
    .replace(/[–—]/g, '-')
    .replace(/fl\.?\s*oz\.?/gi, 'floz')
    .replace(/(?<=\d)\s*\*\s*(?=\d)/g, ' x ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toPart(amountRaw: string, unitRaw: string): Part | null {
  const def = lookupUnit(unitRaw);
  if (!def) return null;
  const amount = toNumber(amountRaw);
  if (!(amount > 0)) return null;
  return { value: canonical(amount, def), dim: def.dim, raw: `${amountRaw} ${unitRaw}` };
}

const same = (a: number, b: number) => Math.abs(a - b) <= 0.005 * Math.max(a, b);
const label = (dim: Dim) => (dim === 'mass' ? 'g' : 'ml');

function make(
  value: number,
  dim: Dim,
  confidence: Quantity['confidence'],
  source: Quantity['source'],
  explanation: string,
): Quantity | null {
  if (!(value > 0) || value > 1_000_000) return null;
  return { value: Math.round(value * 1e4) / 1e4, dim, confidence, source, explanation };
}

function multiply(unit: Part, count: number, parts: Part[]): Quantity | null {
  const total = unit.value * count;
  // Another, different size in the same string (e.g. "(408 g)" is fine, "80 g" is not).
  if (parts.some((p) => !same(p.value, unit.value) && !same(p.value, total))) return null;
  return make(total, unit.dim, 'high', 'pack', `${count} × ${unit.raw} = ${formatAmount(total)} ${label(unit.dim)}`);
}

export function parseQuantity(input: string | null | undefined): Quantity | null {
  if (!input) return null;
  const text = normalise(input);
  if (!text || RANGE_RE.test(text)) return null;

  const parts: Part[] = [];
  for (const m of text.matchAll(QTY_RE)) {
    const p = toPart(m[1], m[2]);
    if (p) parts.push(p);
  }

  const cf = COUNT_FIRST_RE.exec(text);
  if (cf) {
    const unit = toPart(cf[2], cf[3]);
    if (unit) return multiply(unit, Number(cf[1]), parts);
  }
  const ca = COUNT_AFTER_RE.exec(text);
  if (ca) {
    const unit = toPart(ca[1], ca[2]);
    if (unit) return multiply(unit, Number(ca[3]), parts);
  }

  const bonus = BONUS_RE.exec(text);
  if (bonus) {
    const a = toPart(bonus[1], bonus[2]);
    const b = toPart(bonus[3], bonus[4]);
    if (!a || !b || a.dim !== b.dim) return null;
    const total = a.value + b.value;
    if (parts.some((p) => !same(p.value, a.value) && !same(p.value, b.value) && !same(p.value, total))) return null;
    return make(total, a.dim, 'medium', 'bonus', `${a.raw} + ${b.raw} = ${formatAmount(total)} ${label(a.dim)}`);
  }

  if (parts.length === 0) return null;
  const first = parts[0];
  if (parts.some((p) => p.dim !== first.dim || !same(p.value, first.value))) return null;

  const pack = PACK_RE.exec(text);
  const n = pack ? Number(pack[1] ?? pack[2]) : 1;
  if (n > 1) {
    const total = first.value * n;
    return make(total, first.dim, 'medium', 'pack', `${n} × ${first.raw} = ${formatAmount(total)} ${label(first.dim)}`);
  }
  return make(first.value, first.dim, 'high', 'text', `${first.raw} = ${formatAmount(first.value)} ${label(first.dim)}`);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/core/quantity.test.ts`
Expected: PASS (every row). If a row fails, fix the regex or the expectation only after confirming the expectation is correct for a real listing; do not weaken the `UNKNOWN` list.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(core): unit table and quantity parser with corpus tests" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Price, site unit price, analysis, formatting

**Files:**
- Create: `src/core/price.ts`, `src/core/unitprice.ts`, `src/core/analyze.ts`, `src/core/format.ts`
- Test: `tests/core/price.test.ts`, `tests/core/unitprice.test.ts`, `tests/core/analyze.test.ts`, `tests/core/format.test.ts`

**Interfaces:**
- Consumes: `parseQuantity`, `lookupUnit`, `toNumber`, `NUM_PATTERN`, `formatAmount`, types from Task 2.
- Produces:
  - `parsePrice(text: string | null | undefined): number | null`
  - `interface UnitPrice { price: number; perAmount: number; unit: string }`
  - `parseUnitPrice(text: string): UnitPrice | null`
  - `quantityFromUnitPrice(sellingPrice: number, up: UnitPrice): Quantity | null`
  - `analyzeCard(raw: RawCard): CardAnalysis`
  - `formatPer100(per100: number, dim: Dim, crossUnit: boolean): string`

- [ ] **Step 1: Write the failing tests**

`tests/core/price.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parsePrice } from '../../src/core/price';

describe('parsePrice', () => {
  it.each([
    ['₹224', 224],
    ['₹1,299', 1299],
    ['₹1,29,999.00', 129999],
    ['₹ 506.90', 506.9],
    ['224', 224],
    ['Rs. 99', 99],
    ['₹56.', 56],
    ['  ₹120 \n', 120],
  ])('%j -> %d', (text, expected) => {
    expect(parsePrice(text)).toBeCloseTo(expected, 2);
  });

  it.each([
    ['₹1,299 ₹1,999'],
    ['₹251₹279'],
    ['₹80 delivery'],
    ['10% off'],
    ['M.R.P: ₹249'],
    ['Free'],
    [''],
    ['₹0'],
  ])('rejects %j', (text) => {
    expect(parsePrice(text)).toBeNull();
  });

  it('handles null and undefined', () => {
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice(undefined)).toBeNull();
  });
});
```

`tests/core/unitprice.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseUnitPrice, quantityFromUnitPrice } from '../../src/core/unitprice';

describe('parseUnitPrice', () => {
  it('reads the duplicated Amazon text (offscreen + visible)', () => {
    expect(parseUnitPrice('(₹746.67₹746.67/100 g)')).toEqual({ price: 746.67, perAmount: 100, unit: 'g' });
  });
  it('reads spaced and per-kg forms', () => {
    expect(parseUnitPrice('( ₹85.11 ₹85.11/100 g)')).toEqual({ price: 85.11, perAmount: 100, unit: 'g' });
    expect(parseUnitPrice('(₹1,450₹1,450/100 g)')).toEqual({ price: 1450, perAmount: 100, unit: 'g' });
    expect(parseUnitPrice('(₹47₹47/kg)')).toEqual({ price: 47, perAmount: 1, unit: 'kg' });
    expect(parseUnitPrice('(₹398₹398/100 ml)')).toEqual({ price: 398, perAmount: 100, unit: 'ml' });
  });
  it('ignores count and month based unit prices', () => {
    expect(parseUnitPrice('(₹49₹49/count)')).toBeNull();
    expect(parseUnitPrice('EMI from ₹5,000/month')).toBeNull();
  });
  it('returns null for text without a unit price', () => {
    expect(parseUnitPrice('₹224')).toBeNull();
    expect(parseUnitPrice('')).toBeNull();
  });
});

describe('quantityFromUnitPrice', () => {
  it('derives 30 g from ₹224 at ₹746.67/100 g', () => {
    const q = quantityFromUnitPrice(224, { price: 746.67, perAmount: 100, unit: 'g' })!;
    expect(q.value).toBeCloseTo(30, 2);
    expect(q.dim).toBe('mass');
    expect(q.source).toBe('site-unit-price');
    expect(q.confidence).toBe('high');
  });
  it('converts kg to grams', () => {
    const q = quantityFromUnitPrice(239, { price: 47.8, perAmount: 1, unit: 'kg' })!;
    expect(q.value).toBeCloseTo(5000, 0);
  });
  it('derives volume', () => {
    const q = quantityFromUnitPrice(198, { price: 99, perAmount: 100, unit: 'ml' })!;
    expect(q.value).toBeCloseTo(200, 2);
    expect(q.dim).toBe('volume');
  });
  it('rejects non-positive input', () => {
    expect(quantityFromUnitPrice(0, { price: 10, perAmount: 100, unit: 'g' })).toBeNull();
    expect(quantityFromUnitPrice(10, { price: 0, perAmount: 100, unit: 'g' })).toBeNull();
  });
});
```

`tests/core/analyze.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { analyzeCard } from '../../src/core/analyze';
import type { RawCard } from '../../src/core/types';

const base: RawCard = {
  title: '', sizeText: null, priceText: null, unitPriceText: null,
  deliveryNote: null, href: null, sponsored: false, outOfStock: false,
};
const card = (o: Partial<RawCard>): RawCard => ({ ...base, ...o });

describe('analyzeCard', () => {
  it('prefers the site unit price and agrees with the title', () => {
    const a = analyzeCard(card({
      title: 'Minimalist Sunscreen SPF 50 | 30gm', priceText: '₹224', unitPriceText: '(₹746.67₹746.67/100 g)',
    }));
    expect(a.state).toBe('ranked');
    expect(a.quantity!.source).toBe('site-unit-price');
    expect(a.per100).toBeCloseTo(746.67, 1);
    expect(a.note).toBeNull();
  });

  it('uses the title when there is no unit price', () => {
    const a = analyzeCard(card({ title: 'Pilgrim Shampoo - 200ml', priceText: '₹198' }));
    expect(a.per100).toBeCloseTo(99, 2);
    expect(a.quantity!.dim).toBe('volume');
  });

  it('uses the Flipkart size line before the title', () => {
    const a = analyzeCard(card({ title: 'Lays Chips', sizeText: '4 x 26.75 g', priceText: '₹120' }));
    expect(a.quantity!.value).toBeCloseTo(107, 2);
    expect(a.per100).toBeCloseTo(112.14, 1);
  });

  it('falls back to the title when the size line has no unit', () => {
    const a = analyzeCard(card({ title: 'Shampoo 500 ml', sizeText: '500', priceText: '₹250' }));
    expect(a.per100).toBeCloseTo(50, 2);
  });

  it('keeps the site unit price and notes a title disagreement', () => {
    const a = analyzeCard(card({
      title: 'Sunscreen 50 g', priceText: '₹224', unitPriceText: '(₹746.67₹746.67/100 g)',
    }));
    expect(a.quantity!.value).toBeCloseTo(30, 2);
    expect(a.note).toContain('Title says');
  });

  it('is unknown when no quantity can be read', () => {
    const a = analyzeCard(card({ title: 'Pringles', priceText: '₹120' }));
    expect(a.state).toBe('unknown');
    expect(a.per100).toBeNull();
    expect(a.price).toBe(120);
  });

  it('is unknown without a price and unavailable when flagged', () => {
    expect(analyzeCard(card({ title: 'Atta 5 kg' })).state).toBe('unknown');
    expect(analyzeCard(card({ title: 'Atta 5 kg', outOfStock: true })).state).toBe('unavailable');
    expect(analyzeCard(card({ title: 'Atta 5 kg', priceText: '₹239', outOfStock: true })).state).toBe('unavailable');
  });
});
```

`tests/core/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatPer100 } from '../../src/core/format';

describe('formatPer100', () => {
  it('formats small values with two decimals', () => {
    expect(formatPer100(85.114, 'mass', false)).toBe('₹85.11 / 100 g');
    expect(formatPer100(99, 'volume', false)).toBe('₹99.00 / 100 ml');
  });
  it('rounds large values and groups digits the Indian way', () => {
    expect(formatPer100(746.67, 'mass', false)).toBe('₹747 / 100 g');
    expect(formatPer100(123456.4, 'mass', false)).toBe('₹1,23,456 / 100 g');
  });
  it('marks cross-unit comparisons with ≈', () => {
    expect(formatPer100(99, 'volume', true)).toBe('≈ ₹99.00 / 100 ml');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core`
Expected: FAIL — modules `price`, `unitprice`, `analyze`, `format` not found (quantity tests still pass).

- [ ] **Step 3: Write price.ts**

```ts
import { NUM_PATTERN, toNumber } from './units';

const STRICT = new RegExp(`^(?:₹|rs\\.?|inr)?\\s*(${NUM_PATTERN})\\.?$`, 'i');

/** Parses the text of ONE selling-price node. Anything else (ranges, offers, two amounts) is null. */
export function parsePrice(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = STRICT.exec(text.replace(/ /g, ' ').trim());
  if (!m) return null;
  const value = toNumber(m[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}
```

- [ ] **Step 4: Write unitprice.ts**

```ts
import type { Quantity } from './types';
import { NUM_PATTERN, formatAmount, lookupUnit, toNumber } from './units';

const UNIT_PRICE_RE = new RegExp(`₹\\s*(${NUM_PATTERN})\\s*/\\s*(${NUM_PATTERN})?\\s*([A-Za-z]+)`, 'g');

export interface UnitPrice {
  /** ₹ per `perAmount` of `unit`. */
  price: number;
  perAmount: number;
  unit: string;
}

/** Reads the site's own unit price, e.g. "(₹746.67₹746.67/100 g)". Count- and month-based ones are ignored. */
export function parseUnitPrice(text: string): UnitPrice | null {
  for (const m of text.matchAll(UNIT_PRICE_RE)) {
    const unit = m[3].toLowerCase();
    if (!lookupUnit(unit)) continue;
    return { price: toNumber(m[1]), perAmount: m[2] ? toNumber(m[2]) : 1, unit };
  }
  return null;
}

export function quantityFromUnitPrice(sellingPrice: number, up: UnitPrice): Quantity | null {
  const def = lookupUnit(up.unit);
  if (!def || !(up.price > 0) || !(sellingPrice > 0) || !(up.perAmount > 0)) return null;
  const value = (sellingPrice / up.price) * up.perAmount * def.factor;
  if (!(value > 0) || value > 1_000_000) return null;
  const per = up.perAmount === 1 ? up.unit : `${up.perAmount} ${up.unit}`;
  return {
    value: Math.round(value * 1e4) / 1e4,
    dim: def.dim,
    confidence: 'high',
    source: 'site-unit-price',
    explanation: `₹${sellingPrice} at ₹${up.price}/${per} = ${formatAmount(value)} ${def.label}`,
  };
}
```

- [ ] **Step 5: Write analyze.ts**

```ts
import type { CardAnalysis, Quantity, RawCard } from './types';
import { parsePrice } from './price';
import { parseQuantity } from './quantity';
import { parseUnitPrice, quantityFromUnitPrice } from './unitprice';

const DISAGREE = 0.03;

function agree(a: Quantity, b: Quantity): boolean {
  return a.dim === b.dim && Math.abs(a.value - b.value) <= DISAGREE * Math.max(a.value, b.value);
}

export function analyzeCard(raw: RawCard): CardAnalysis {
  const price = parsePrice(raw.priceText);
  if (raw.outOfStock) return { state: 'unavailable', price, quantity: null, per100: null, note: null };
  if (price === null) return { state: 'unknown', price: null, quantity: null, per100: null, note: null };

  const up = raw.unitPriceText ? parseUnitPrice(raw.unitPriceText) : null;
  const fromSite = up ? quantityFromUnitPrice(price, up) : null;
  const fromText = (raw.sizeText ? parseQuantity(raw.sizeText) : null) ?? parseQuantity(raw.title);

  const quantity = fromSite ?? fromText;
  if (!quantity) return { state: 'unknown', price, quantity: null, per100: null, note: null };

  const note =
    fromSite && fromText && !agree(fromSite, fromText)
      ? `Title says ${fromText.explanation}; using the site's unit price.`
      : null;
  return { state: 'ranked', price, quantity, per100: (price / quantity.value) * 100, note };
}
```

- [ ] **Step 6: Write format.ts**

```ts
import type { Dim } from './types';

export function formatPer100(per100: number, dim: Dim, crossUnit: boolean): string {
  const amount = per100 < 100 ? per100.toFixed(2) : Math.round(per100).toLocaleString('en-IN');
  return `${crossUnit ? '≈ ' : ''}₹${amount} / 100 ${dim === 'mass' ? 'g' : 'ml'}`;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/core && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(core): price parser, site unit price, card analysis, formatting" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Ranking

**Files:**
- Create: `src/core/rank.ts`
- Test: `tests/core/rank.test.ts`

**Interfaces:**
- Consumes: `CardState`, `Dim`.
- Produces:
  - `type SortDir = 'asc' | 'desc'`
  - `interface SortEntry { per100: number | null; state: CardState }`
  - `sortOrder(entries: SortEntry[], dir: SortDir): number[]` — indices into `entries` in display order.
  - `dominantDim(dims: Dim[]): Dim | null`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { dominantDim, sortOrder, type SortEntry } from '../../src/core/rank';

const r = (per100: number): SortEntry => ({ per100, state: 'ranked' });
const u: SortEntry = { per100: null, state: 'unknown' };
const n: SortEntry = { per100: null, state: 'unavailable' };

describe('sortOrder', () => {
  it('sorts ranked ascending, then unknown, then unavailable', () => {
    expect(sortOrder([n, r(30), u, r(10), r(20)], 'asc')).toEqual([3, 4, 1, 2, 0]);
  });
  it('sorts ranked descending but keeps unknown/unavailable last', () => {
    expect(sortOrder([n, r(30), u, r(10), r(20)], 'desc')).toEqual([1, 4, 3, 2, 0]);
  });
  it('keeps original order for ties', () => {
    expect(sortOrder([r(5), r(5), r(5)], 'asc')).toEqual([0, 1, 2]);
    expect(sortOrder([r(5), r(5), r(5)], 'desc')).toEqual([0, 1, 2]);
  });
  it('handles empty input', () => {
    expect(sortOrder([], 'asc')).toEqual([]);
  });
});

describe('dominantDim', () => {
  it('returns the majority dimension', () => {
    expect(dominantDim(['mass', 'volume', 'mass'])).toBe('mass');
    expect(dominantDim(['volume', 'volume', 'mass'])).toBe('volume');
  });
  it('breaks ties by first seen and handles empty', () => {
    expect(dominantDim(['volume', 'mass'])).toBe('volume');
    expect(dominantDim([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/rank.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write rank.ts**

```ts
import type { CardState, Dim } from './types';

export type SortDir = 'asc' | 'desc';

export interface SortEntry {
  per100: number | null;
  state: CardState;
}

const GROUP: Record<CardState, number> = { ranked: 0, unknown: 1, unavailable: 2 };

/** Returns indices into `entries` in display order. Stable: ties keep their original order. */
export function sortOrder(entries: SortEntry[], dir: SortDir): number[] {
  const sign = dir === 'asc' ? 1 : -1;
  return entries
    .map((_, i) => i)
    .sort((a, b) => {
      const ea = entries[a];
      const eb = entries[b];
      const g = GROUP[ea.state] - GROUP[eb.state];
      if (g !== 0) return g;
      if (ea.state === 'ranked') {
        const d = (ea.per100! - eb.per100!) * sign;
        if (d !== 0) return d;
      }
      return a - b;
    });
}

/** The dimension most ranked cards use; the other one gets the ≈ marker. */
export function dominantDim(dims: Dim[]): Dim | null {
  if (dims.length === 0) return null;
  const counts = new Map<Dim, number>();
  for (const d of dims) counts.set(d, (counts.get(d) ?? 0) + 1);
  let best: Dim = dims[0];
  for (const [d, c] of counts) if (c > counts.get(best)!) best = d;
  return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/rank.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): stable ranking and dominant dimension" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Fixtures and the Amazon adapter

**Files:**
- Create: `scripts/trim-fixture.mjs`, `src/adapters/types.ts`, `src/adapters/amazon.ts`, `src/adapters/index.ts` (Amazon only for now), `tests/helpers.ts`, `tests/fixtures/amazon/*.html`
- Test: `tests/adapters/amazon.test.ts`

**Interfaces:**
- Consumes: `RawCard`, `analyzeCard`.
- Produces:
  - ```ts
    export interface SiteAdapter {
      id: string;
      matches(url: URL): boolean;
      isListingPage(url: URL): boolean;
      cardSelector: string;
      extract(card: Element): RawCard;
      sortNode(card: Element): Element;
      reorder: 'css-order' | 'dom-slots';
    }
    ```
  - `amazon: SiteAdapter`, `pickAdapter(url: URL): SiteAdapter | null`
  - `tests/helpers.ts`: `loadFixture(name: string): string` (name like `amazon/sunscreen`), `mountFixture(name: string): void`

Live facts this task encodes (verified 2026-10-09, Amazon.in search pages in headless Brave): card = `[data-component-type="s-search-result"]` (48 per page); title = `[data-cy="title-recipe"] a h2` (a brand-only `h2` sits outside the `a`); selling price = `[data-cy="price-recipe"] .a-price:not(.a-text-price) .a-offscreen`; unit price = the `span` in the price recipe whose text is `(₹…/100 g)`; the `.a-text-price` nodes are the unit price and the MRP, **not** the selling price; the grid parent `.s-main-slot` is `display: grid`.

- [ ] **Step 1: Write the fixture trimmer**

`scripts/trim-fixture.mjs`:
```js
// Usage: node scripts/trim-fixture.mjs <saved-page.html> <tests/fixtures/site/name.html>
// Keeps only <body> markup: no scripts, styles, images, comments or inline styles.
import { JSDOM } from 'jsdom';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const [src, dest] = process.argv.slice(2);
if (!src || !dest) {
  console.error('usage: node scripts/trim-fixture.mjs <src.html> <dest.html>');
  process.exit(1);
}
const dom = new JSDOM(readFileSync(src, 'utf8'));
const { document, NodeFilter } = dom.window;
document
  .querySelectorAll('script,style,link,noscript,svg,img,picture,source,iframe,video,audio,canvas,template')
  .forEach((n) => n.remove());
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
const comments = [];
while (walker.nextNode()) comments.push(walker.currentNode);
comments.forEach((c) => c.remove());
document.body.querySelectorAll('*').forEach((el) => {
  for (const a of Array.from(el.attributes)) {
    if (a.name === 'style' || a.name.startsWith('on')) el.removeAttribute(a.name);
  }
});
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, document.body.innerHTML);
console.log(dest, document.body.innerHTML.length, 'bytes');
```

- [ ] **Step 2: Generate Amazon fixtures from the pages saved during probing**

The pages were captured on 2026-10-09 with headless Brave from `https://www.amazon.in/s?k=<query>` and saved in `/mnt/data/Tools/_dom-probe/`.

Run:
```bash
cd /mnt/data/Tools/price-scout-extension
for q in sunscreen potato-chips wheat-flour-atta shampoo; do
  node scripts/trim-fixture.mjs /mnt/data/Tools/_dom-probe/amazon-$q.html tests/fixtures/amazon/$q.html
done
ls -la tests/fixtures/amazon
```
Expected: four files, each a few hundred KB. If any is above 1.5 MB, also remove `[data-component-type="s-ads-metrics"]` and `#navbar`/footer blocks in the trimmer before continuing.

- [ ] **Step 3: Write tests/helpers.ts**

```ts
import { readFileSync } from 'node:fs';

export function loadFixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8');
}

export function mountFixture(name: string): void {
  document.body.innerHTML = loadFixture(name);
}
```

- [ ] **Step 4: Write the failing adapter test**

`tests/adapters/amazon.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { amazon } from '../../src/adapters/amazon';
import { pickAdapter } from '../../src/adapters';
import { analyzeCard } from '../../src/core/analyze';
import { mountFixture } from '../helpers';

const QUERIES = ['sunscreen', 'potato-chips', 'wheat-flour-atta', 'shampoo'];
const cards = () => Array.from(document.querySelectorAll(amazon.cardSelector));

describe('amazon adapter: routing', () => {
  it('matches amazon.in search pages only', () => {
    expect(amazon.matches(new URL('https://www.amazon.in/s?k=x'))).toBe(true);
    expect(amazon.matches(new URL('https://www.amazon.com/s?k=x'))).toBe(false);
    expect(amazon.isListingPage(new URL('https://www.amazon.in/s?k=x'))).toBe(true);
    expect(amazon.isListingPage(new URL('https://www.amazon.in/dp/B0CW5BK193'))).toBe(false);
    expect(pickAdapter(new URL('https://www.amazon.in/s?k=x'))).toBe(amazon);
    expect(pickAdapter(new URL('https://example.com/'))).toBeNull();
  });
  it('reorders with CSS order', () => {
    expect(amazon.reorder).toBe('css-order');
  });
});

describe('amazon adapter: sunscreen fixture', () => {
  beforeEach(() => mountFixture('amazon/sunscreen'));

  it('finds 48 result cards', () => {
    expect(cards()).toHaveLength(48);
  });

  it('extracts the first card exactly', () => {
    const raw = amazon.extract(cards()[0]);
    expect(raw.title).toMatch(/^Minimalist Sunscreen SPF 50/);
    expect(raw.title).toMatch(/30gm$/);
    expect(raw.priceText).toBe('₹224');
    expect(raw.unitPriceText).toContain('746.67');
    expect(raw.unitPriceText).toContain('/100 g');
    expect(raw.outOfStock).toBe(false);
    expect(raw.href).toMatch(/^\//);
    const a = analyzeCard(raw);
    expect(a.state).toBe('ranked');
    expect(a.per100).toBeCloseTo(746.67, 1);
  });

  it('does not mistake the unit price or MRP for the selling price', () => {
    for (const c of cards()) {
      const raw = amazon.extract(c);
      if (raw.priceText) expect(raw.priceText).toMatch(/^₹[\d,]+(\.\d+)?$/);
    }
  });
});

describe.each(QUERIES)('amazon adapter: %s fixture', (q) => {
  beforeEach(() => mountFixture(`amazon/${q}`));

  it('ranks at least 90% of priced cards', () => {
    const analyses = cards().map((c) => analyzeCard(amazon.extract(c)));
    const priced = analyses.filter((a) => a.price !== null);
    const ranked = priced.filter((a) => a.state === 'ranked');
    expect(priced.length).toBeGreaterThan(20);
    expect(ranked.length / priced.length).toBeGreaterThanOrEqual(0.9);
  });

  it('flags unavailable cards instead of ranking them', () => {
    for (const c of cards()) {
      const raw = amazon.extract(c);
      if (raw.priceText === null && /currently unavailable/i.test(c.textContent ?? '')) {
        expect(analyzeCard(raw).state).toBe('unavailable');
      }
    }
  });

  it('title text and the site unit price agree on at least 90% of cards that have both', () => {
    let both = 0;
    let disagree = 0;
    for (const c of cards()) {
      const a = analyzeCard(amazon.extract(c));
      if (a.quantity?.source === 'site-unit-price') {
        both++;
        if (a.note) disagree++;
      }
    }
    // `note` is set only when a title quantity exists AND differs from the unit price.
    expect(both).toBeGreaterThan(20);
    expect(disagree / both).toBeLessThanOrEqual(0.1);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run tests/adapters/amazon.test.ts`
Expected: FAIL — cannot resolve `../../src/adapters/amazon`.

- [ ] **Step 6: Write adapters/types.ts**

```ts
import type { RawCard } from '../core/types';

export interface SiteAdapter {
  id: string;
  matches(url: URL): boolean;
  isListingPage(url: URL): boolean;
  cardSelector: string;
  extract(card: Element): RawCard;
  /** The element to reorder for this card (usually the card itself). */
  sortNode(card: Element): Element;
  reorder: 'css-order' | 'dom-slots';
}

export const clean = (el: Element | null | undefined): string =>
  el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
```

- [ ] **Step 7: Write adapters/amazon.ts**

```ts
import type { SiteAdapter } from './types';
import { clean } from './types';

const DELIVERY_RE = /₹\s*([\d,]+)\s+delivery/i;

export const amazon: SiteAdapter = {
  id: 'amazon',
  matches: (url) => url.hostname === 'www.amazon.in' || url.hostname === 'amazon.in',
  isListingPage: (url) => url.pathname === '/s',
  cardSelector: '[data-component-type="s-search-result"][data-asin]:not([data-asin=""])',
  sortNode: (card) => card,
  reorder: 'css-order',

  extract(card) {
    const title = clean(card.querySelector('[data-cy="title-recipe"] a h2') ?? card.querySelector('h2'));
    const recipe = card.querySelector('[data-cy="price-recipe"]');
    const sell = recipe?.querySelector('.a-price:not(.a-text-price) .a-offscreen');
    const unitEl = recipe
      ? Array.from(recipe.querySelectorAll('span')).find((s) => /^\(.*\/.*\)$/.test(clean(s)))
      : undefined;
    const delivery = DELIVERY_RE.exec(clean(card));
    const priceText = sell ? clean(sell) : null;
    return {
      title,
      sizeText: null,
      priceText,
      unitPriceText: unitEl ? clean(unitEl) : null,
      deliveryNote: delivery ? `Delivery ₹${delivery[1]}` : null,
      href: card.querySelector('[data-cy="title-recipe"] a')?.getAttribute('href') ?? null,
      // Best effort: no sponsored card appeared in the six probed queries.
      sponsored: !!card.querySelector('.puis-sponsored-label-text, [data-component-type="sp-sponsored-result"]'),
      outOfStock: priceText === null && /currently unavailable/i.test(clean(card)),
    };
  },
};
```

- [ ] **Step 8: Write adapters/index.ts**

```ts
import { amazon } from './amazon';
import type { SiteAdapter } from './types';

export const ADAPTERS: SiteAdapter[] = [amazon];

export function pickAdapter(url: URL): SiteAdapter | null {
  return ADAPTERS.find((a) => a.matches(url)) ?? null;
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run tests/adapters/amazon.test.ts`
Expected: PASS. If the 90% thresholds fail, print the failing titles, find the cause (parser gap or adapter bug), fix that, and only then re-run. Do not lower thresholds to make it pass.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(adapters): Amazon.in adapter with live-captured fixtures" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Flipkart adapter

**Files:**
- Create: `src/adapters/flipkart.ts`, `tests/fixtures/flipkart/*.html`
- Modify: `src/adapters/index.ts`
- Test: `tests/adapters/flipkart.test.ts`

**Interfaces:**
- Consumes: `SiteAdapter`, `clean`, `analyzeCard`, `mountFixture`.
- Produces: `flipkart: SiteAdapter`; `ADAPTERS = [amazon, flipkart]`.

Live facts (verified 2026-10-09): card = `div[data-id]` (40 per page, a few `data-id`s repeat); cards sit four per flex row, so reordering is `dom-slots`; title = `a[title]` (visible text is truncated with `...`, the `title` attribute is full); the size line is the element right after that anchor (`30 g`, `4 x 102 g`, `1 L`, occasionally a bare `500`); the first leaf node matching `₹digits` is the selling price, the second is the struck MRP; results are paginated by page links (scrolling added no cards).

- [ ] **Step 1: Generate fixtures**

Run:
```bash
cd /mnt/data/Tools/price-scout-extension
for q in sunscreen shampoo potato-chips wheat-flour-atta; do
  node scripts/trim-fixture.mjs /mnt/data/Tools/_dom-probe/flipkart-$q.html tests/fixtures/flipkart/$q.html
done
ls -la tests/fixtures/flipkart
```
Expected: four files.

- [ ] **Step 2: Write the failing test**

`tests/adapters/flipkart.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { flipkart } from '../../src/adapters/flipkart';
import { pickAdapter } from '../../src/adapters';
import { analyzeCard } from '../../src/core/analyze';
import { mountFixture } from '../helpers';

const QUERIES = ['sunscreen', 'shampoo', 'potato-chips', 'wheat-flour-atta'];
const cards = () => Array.from(document.querySelectorAll(flipkart.cardSelector));

describe('flipkart adapter: routing', () => {
  it('matches flipkart.com /search only', () => {
    expect(flipkart.matches(new URL('https://www.flipkart.com/search?q=x'))).toBe(true);
    expect(flipkart.matches(new URL('https://www.amazon.in/s?k=x'))).toBe(false);
    expect(flipkart.isListingPage(new URL('https://www.flipkart.com/search?q=x'))).toBe(true);
    expect(flipkart.isListingPage(new URL('https://www.flipkart.com/'))).toBe(false);
    expect(pickAdapter(new URL('https://www.flipkart.com/search?q=x'))).toBe(flipkart);
  });
  it('reorders by filling DOM slots (cards live in rows of four)', () => {
    expect(flipkart.reorder).toBe('dom-slots');
  });
});

describe('flipkart adapter: sunscreen fixture', () => {
  beforeEach(() => mountFixture('flipkart/sunscreen'));

  it('finds 40 cards', () => {
    expect(cards()).toHaveLength(40);
  });

  it('extracts the first card exactly', () => {
    const raw = flipkart.extract(cards()[0]);
    expect(raw.title).toMatch(/^Deconstruct Sunscreen - SPF 50/);
    expect(raw.title.endsWith('...')).toBe(false);
    expect(raw.sizeText).toBe('30 g');
    expect(raw.priceText).toBe('₹251');
    expect(raw.unitPriceText).toBeNull();
    expect(raw.href).toContain('/p/itm');
    const a = analyzeCard(raw);
    expect(a.per100).toBeCloseTo(836.67, 1);
  });

  it('reads the selling price, not the MRP', () => {
    const raw = flipkart.extract(cards()[2]);
    expect(raw.priceText).toBe('₹120');
  });
});

describe.each(QUERIES)('flipkart adapter: %s fixture', (q) => {
  beforeEach(() => mountFixture(`flipkart/${q}`));

  it('ranks at least 90% of cards', () => {
    const analyses = cards().map((c) => analyzeCard(flipkart.extract(c)));
    const ranked = analyses.filter((a) => a.state === 'ranked');
    expect(analyses.length).toBeGreaterThan(30);
    expect(ranked.length / analyses.length).toBeGreaterThanOrEqual(0.9);
  });

  it('every card is a direct child of a row that holds only cards', () => {
    for (const c of cards()) {
      const kids = Array.from(c.parentElement!.children);
      expect(kids.every((k) => k.matches(flipkart.cardSelector))).toBe(true);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/adapters/flipkart.test.ts`
Expected: FAIL — cannot resolve `../../src/adapters/flipkart`.

- [ ] **Step 4: Write adapters/flipkart.ts**

```ts
import type { SiteAdapter } from './types';
import { clean } from './types';

const PRICE_LEAF = /^₹\s?\d[\d,]*(\.\d+)?$/;
const SOLD_OUT = /sold out|currently unavailable|out of stock/i;

export const flipkart: SiteAdapter = {
  id: 'flipkart',
  matches: (url) => url.hostname === 'www.flipkart.com' || url.hostname === 'flipkart.com',
  isListingPage: (url) => url.pathname === '/search',
  cardSelector: 'div[data-id]',
  sortNode: (card) => card,
  reorder: 'dom-slots',

  extract(card) {
    // No hashed class names: the structure is title anchor, then the size line, then rating, then prices.
    const anchor = card.querySelector('a[title]');
    const sizeRaw = clean(anchor?.nextElementSibling);
    const leaves = Array.from(card.querySelectorAll('*')).filter((e) => e.children.length === 0);
    const priceEl = leaves.find((e) => PRICE_LEAF.test(clean(e)));
    return {
      title: anchor?.getAttribute('title')?.trim() ?? '',
      sizeText: sizeRaw && sizeRaw.length <= 40 ? sizeRaw : null,
      priceText: priceEl ? clean(priceEl) : null,
      unitPriceText: null,
      deliveryNote: null,
      href: card.querySelector('a[href*="/p/"]')?.getAttribute('href') ?? null,
      sponsored: leaves.some((e) => clean(e) === 'Ad'),
      outOfStock: SOLD_OUT.test(clean(card)),
    };
  },
};
```

- [ ] **Step 5: Register the adapter**

Edit `src/adapters/index.ts`:
```ts
import { amazon } from './amazon';
import { flipkart } from './flipkart';
import type { SiteAdapter } from './types';

export const ADAPTERS: SiteAdapter[] = [amazon, flipkart];

export function pickAdapter(url: URL): SiteAdapter | null {
  return ADAPTERS.find((a) => a.matches(url)) ?? null;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/adapters`
Expected: PASS. First-card per100 is `251 / 30 × 100 = 836.67`. If the 90% threshold fails, list the unknown titles and fix the parser or adapter before re-running.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(adapters): Flipkart adapter with live-captured fixtures" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Reorderers

**Files:**
- Create: `src/content/reorder.ts`
- Test: `tests/content/reorder.test.ts`

**Interfaces:**
- Produces:
  - `type ReorderStrategy = 'css-order' | 'dom-slots'`
  - `interface Reorderer { apply(nodes: Element[], order: number[]): void; reset(nodes: Element[]): void }`
  - `createReorderer(strategy: ReorderStrategy): Reorderer`
  - `nodes` is in first-seen (original) order; `order[p]` is the index in `nodes` of the element that should be displayed at position `p`.

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createReorderer } from '../../src/content/reorder';

const texts = (root: Element) => Array.from(root.querySelectorAll('i')).map((e) => e.textContent);

describe('css-order reorderer', () => {
  let grid: HTMLElement;
  let nodes: HTMLElement[];
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="g"><i>A</i><b id="w">widget</b><i>B</i><i>C</i></div>';
    grid = document.getElementById('g')!;
    nodes = Array.from(grid.querySelectorAll('i'));
  });

  it('assigns order values by sorted position and keeps the widget between sorted cards', () => {
    createReorderer('css-order').apply(nodes, [2, 0, 1]); // C, A, B
    expect(nodes[2].style.order).toBe('2'); // C first
    expect(nodes[0].style.order).toBe('4'); // A second
    expect(nodes[1].style.order).toBe('6'); // B third
    // widget sat after 1 card, so it gets 2*1+1 = 3: after the first sorted card, before the second
    expect(document.getElementById('w')!.style.order).toBe('3');
  });

  it('does not move DOM nodes', () => {
    createReorderer('css-order').apply(nodes, [2, 1, 0]);
    expect(texts(grid)).toEqual(['A', 'B', 'C']);
  });

  it('reset clears every order it set', () => {
    const r = createReorderer('css-order');
    r.apply(nodes, [2, 0, 1]);
    r.reset(nodes);
    expect(nodes.every((n) => n.style.order === '')).toBe(true);
    expect(document.getElementById('w')!.style.order).toBe('');
  });
});

describe('dom-slots reorderer', () => {
  let nodes: HTMLElement[];
  const rows = () => Array.from(document.querySelectorAll('.row'));
  beforeEach(() => {
    document.body.innerHTML =
      '<div class="row"><i>A</i><i>B</i></div><p id="banner">ad</p><div class="row"><i>C</i><i>D</i></div>';
    nodes = Array.from(document.querySelectorAll('i'));
  });

  it('fills the existing slots across separate rows', () => {
    createReorderer('dom-slots').apply(nodes, [3, 2, 1, 0]); // D C B A
    expect(texts(rows()[0])).toEqual(['D', 'C']);
    expect(texts(rows()[1])).toEqual(['B', 'A']);
  });

  it('leaves other elements where they were', () => {
    createReorderer('dom-slots').apply(nodes, [3, 2, 1, 0]);
    expect(document.body.children[1].id).toBe('banner');
    expect(document.body.children).toHaveLength(3);
  });

  it('leaves no placeholder comments behind', () => {
    createReorderer('dom-slots').apply(nodes, [1, 0, 3, 2]);
    const comments = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
    expect(comments.nextNode()).toBeNull();
  });

  it('reset restores the first-seen order even after several sorts', () => {
    const r = createReorderer('dom-slots');
    r.apply(nodes, [3, 2, 1, 0]);
    r.apply(nodes, [2, 0, 3, 1]);
    r.reset(nodes);
    expect(texts(rows()[0])).toEqual(['A', 'B']);
    expect(texts(rows()[1])).toEqual(['C', 'D']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/content/reorder.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write reorder.ts**

```ts
export type ReorderStrategy = 'css-order' | 'dom-slots';

export interface Reorderer {
  /** `nodes` are in first-seen order; `order[p]` is the index in `nodes` shown at position `p`. */
  apply(nodes: Element[], order: number[]): void;
  reset(nodes: Element[]): void;
}

function cssOrder(): Reorderer {
  const touched = new Set<HTMLElement>();
  return {
    apply(nodes, order) {
      const parent = nodes[0]?.parentElement;
      if (!parent) return;
      const isCard = new Set<Element>(nodes);
      // Non-card children (widgets) keep their place: odd values sit between sorted cards.
      let cardsSeen = 0;
      for (const child of Array.from(parent.children) as HTMLElement[]) {
        if (isCard.has(child)) {
          cardsSeen++;
          continue;
        }
        child.style.order = String(2 * cardsSeen + 1);
        touched.add(child);
      }
      order.forEach((nodeIndex, position) => {
        const node = nodes[nodeIndex] as HTMLElement;
        node.style.order = String(2 * position + 2);
        touched.add(node);
      });
    },
    reset() {
      for (const el of touched) el.style.removeProperty('order');
      touched.clear();
    },
  };
}

function domSlots(): Reorderer {
  const apply: Reorderer['apply'] = (nodes, order) => {
    const inDom = [...nodes].sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
    const slots = inDom.map((node) => {
      const marker = document.createComment('');
      node.before(marker);
      return marker;
    });
    order.forEach((nodeIndex, position) => slots[position].after(nodes[nodeIndex]));
    slots.forEach((marker) => marker.remove());
  };
  return {
    apply,
    reset: (nodes) => apply(nodes, nodes.map((_, i) => i)),
  };
}

export function createReorderer(strategy: ReorderStrategy): Reorderer {
  return strategy === 'css-order' ? cssOrder() : domSlots();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/content/reorder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(content): css-order and dom-slots reorderers" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Badge, toolbar, controller, boot loop

**Files:**
- Create: `src/content/badge.ts`, `src/content/toolbar.ts`, `src/content/controller.ts`
- Modify: `src/content/main.ts`
- Test: `tests/content/controller.test.ts`, `tests/content/main.test.ts`

**Interfaces:**
- Consumes: `SiteAdapter`, `analyzeCard`, `formatPer100`, `sortOrder`, `dominantDim`, `createReorderer`, `pickAdapter`, `CardAnalysis`, `RawCard`.
- Produces:
  - `interface BadgeView { text: string; sub: string | null; tooltip: string; muted: boolean }`
  - `createBadge(view: BadgeView): HTMLElement`, `updateBadge(host: HTMLElement, view: BadgeView): void`, `attachBadge(card: HTMLElement, host: HTMLElement): void`
  - `interface Toolbar { setStats(s: { ranked: number; unknown: number; unavailable: number }): void; setActive(dir: SortDir | null): void; destroy(): void }`, `mountToolbar(onSort: (dir: SortDir | null) => void): Toolbar`
  - `class ListingController { constructor(adapter: SiteAdapter); start(): void; scan(): void; setSort(dir: SortDir | null): void; destroy(): void }`
  - `main.ts`: boots `tick()` on load, on `popstate`, and on a throttled `MutationObserver`.

- [ ] **Step 1: Write the failing controller test**

`tests/content/controller.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { amazon } from '../../src/adapters/amazon';
import { flipkart } from '../../src/adapters/flipkart';
import { analyzeCard } from '../../src/core/analyze';
import { ListingController } from '../../src/content/controller';
import { mountFixture } from '../helpers';

const toolbar = () => document.querySelector('price-scout-toolbar') as HTMLElement | null;
const click = (dir: string) =>
  (toolbar()!.shadowRoot!.querySelector(`[data-dir="${dir}"]`) as HTMLButtonElement).click();

describe('ListingController on the Amazon fixture', () => {
  let c: ListingController;
  beforeEach(() => {
    mountFixture('amazon/sunscreen');
    c = new ListingController(amazon);
    c.start();
  });
  afterEach(() => c.destroy());

  it('puts one badge on every card and mounts the toolbar', () => {
    const cards = document.querySelectorAll(amazon.cardSelector);
    expect(document.querySelectorAll('price-scout-badge')).toHaveLength(cards.length);
    expect(toolbar()).not.toBeNull();
  });

  it('shows the per-100 value and the ≈ marker for the minority dimension', () => {
    const first = document.querySelector(amazon.cardSelector)!;
    const badge = first.querySelector('price-scout-badge')!.shadowRoot!.textContent!;
    expect(badge).toContain('₹747 / 100 g');
    const texts = Array.from(document.querySelectorAll('price-scout-badge')).map((b) => b.shadowRoot!.textContent!);
    expect(texts.some((t) => t.includes('≈') && t.includes('/ 100 ml'))).toBe(true);
  });

  it('sorts ascending by CSS order, ranked first', () => {
    click('asc');
    const cards = Array.from(document.querySelectorAll<HTMLElement>(amazon.cardSelector));
    const shown = cards
      .sort((a, b) => Number(a.style.order) - Number(b.style.order))
      .map((el) => analyzeCard(amazon.extract(el)));
    const ranked = shown.filter((a) => a.state === 'ranked').map((a) => a.per100!);
    expect(ranked.length).toBeGreaterThan(30);
    expect([...ranked].sort((a, b) => a - b)).toEqual(ranked);
    const firstNonRanked = shown.findIndex((a) => a.state !== 'ranked');
    if (firstNonRanked >= 0) expect(shown.slice(firstNonRanked).every((a) => a.state !== 'ranked')).toBe(true);
  });

  it('sorts descending and resets', () => {
    click('desc');
    const cards = Array.from(document.querySelectorAll<HTMLElement>(amazon.cardSelector));
    const ranked = cards
      .sort((a, b) => Number(a.style.order) - Number(b.style.order))
      .map((el) => analyzeCard(amazon.extract(el)))
      .filter((a) => a.state === 'ranked')
      .map((a) => a.per100!);
    expect([...ranked].sort((a, b) => b - a)).toEqual(ranked);
    click('reset');
    expect(Array.from(document.querySelectorAll<HTMLElement>(amazon.cardSelector)).every((el) => el.style.order === '')).toBe(true);
  });

  it('does not add a second badge when scanned again', () => {
    const before = document.querySelectorAll('price-scout-badge').length;
    c.scan();
    c.scan();
    expect(document.querySelectorAll('price-scout-badge')).toHaveLength(before);
  });

  it('badges and sorts cards that appear later while a sort is active', () => {
    click('asc');
    const last = document.querySelectorAll(amazon.cardSelector).length;
    const clone = document.querySelector(amazon.cardSelector)!.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('price-scout-badge').forEach((b) => b.remove());
    clone.style.order = '';
    document.querySelector(amazon.cardSelector)!.parentElement!.append(clone);
    c.scan();
    expect(document.querySelectorAll('price-scout-badge')).toHaveLength(last + 1);
    expect(clone.style.order).not.toBe('');
  });

  it('re-attaches a badge that the site removed', () => {
    const first = document.querySelector(amazon.cardSelector)!;
    first.querySelector('price-scout-badge')!.remove();
    c.scan();
    expect(first.querySelector('price-scout-badge')).not.toBeNull();
  });

  it('removes everything on destroy', () => {
    click('asc');
    c.destroy();
    expect(document.querySelectorAll('price-scout-badge')).toHaveLength(0);
    expect(toolbar()).toBeNull();
    expect(Array.from(document.querySelectorAll<HTMLElement>(amazon.cardSelector)).every((el) => el.style.order === '')).toBe(true);
  });
});

describe('ListingController on the Flipkart fixture', () => {
  let c: ListingController;
  beforeEach(() => {
    mountFixture('flipkart/shampoo');
    c = new ListingController(flipkart);
    c.start();
  });
  afterEach(() => c.destroy());

  const perHundreds = () =>
    Array.from(document.querySelectorAll(flipkart.cardSelector))
      .map((el) => analyzeCard(flipkart.extract(el)))
      .filter((a) => a.state === 'ranked')
      .map((a) => a.per100!);

  it('reorders cards across rows, ascending', () => {
    const before = Array.from(document.querySelectorAll(flipkart.cardSelector));
    click('asc');
    const after = Array.from(document.querySelectorAll(flipkart.cardSelector));
    expect(after).toHaveLength(before.length);
    expect(new Set(after)).toEqual(new Set(before));
    const v = perHundreds();
    expect(v.length).toBeGreaterThan(30);
    expect([...v].sort((a, b) => a - b)).toEqual(v);
  });

  it('restores the original order on reset', () => {
    const before = Array.from(document.querySelectorAll(flipkart.cardSelector));
    click('asc');
    click('reset');
    expect(Array.from(document.querySelectorAll(flipkart.cardSelector))).toEqual(before);
  });

  it('keeps the row structure: every row still holds only cards', () => {
    click('desc');
    for (const card of document.querySelectorAll(flipkart.cardSelector)) {
      expect(Array.from(card.parentElement!.children).every((k) => k.matches(flipkart.cardSelector))).toBe(true);
    }
  });
});
```

`tests/content/main.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountFixture } from '../helpers';

describe('boot loop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    document.documentElement.removeAttribute('data-price-scout');
    document.body.innerHTML = '';
  });
  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState({}, '', '/');
  });

  it('does nothing off supported sites', async () => {
    mountFixture('amazon/sunscreen');
    await import('../../src/content/main');
    vi.advanceTimersByTime(1000);
    expect(document.querySelectorAll('price-scout-badge')).toHaveLength(0);
  });

  it('boots once on a supported listing and re-scans when the page changes', async () => {
    const { tick } = await import('../../src/content/main');
    mountFixture('amazon/sunscreen');
    tick(new URL('https://www.amazon.in/s?k=sunscreen'));
    const n = document.querySelectorAll('price-scout-badge').length;
    expect(n).toBeGreaterThan(30);
    tick(new URL('https://www.amazon.in/s?k=sunscreen'));
    expect(document.querySelectorAll('price-scout-badge')).toHaveLength(n);
    expect(document.querySelectorAll('price-scout-toolbar')).toHaveLength(1);
  });

  it('tears down when navigating to a non-listing page and rebuilds on a new search', async () => {
    const { tick } = await import('../../src/content/main');
    mountFixture('amazon/sunscreen');
    tick(new URL('https://www.amazon.in/s?k=sunscreen'));
    tick(new URL('https://www.amazon.in/dp/B0CW5BK193'));
    expect(document.querySelectorAll('price-scout-badge')).toHaveLength(0);
    expect(document.querySelectorAll('price-scout-toolbar')).toHaveLength(0);
    tick(new URL('https://www.amazon.in/s?k=shampoo'));
    expect(document.querySelectorAll('price-scout-toolbar')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/content`
Expected: FAIL — `controller`, `badge`, `toolbar` not found, `tick` not exported (reorder tests still pass).

- [ ] **Step 3: Write badge.ts**

```ts
export interface BadgeView {
  text: string;
  sub: string | null;
  tooltip: string;
  muted: boolean;
}

const STYLE = `
:host { all: initial; }
.b { font: 600 12px/1.25 system-ui, sans-serif; background: #0b5d1e; color: #fff; padding: 4px 8px;
  border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,.35); white-space: nowrap; display: inline-block; }
.b.muted { background: #5f6368; font-weight: 500; }
.s { display: block; font-weight: 400; font-size: 10px; opacity: .9; }
`;

export function createBadge(view: BadgeView): HTMLElement {
  const host = document.createElement('price-scout-badge');
  host.style.cssText = 'position:absolute;top:6px;left:6px;z-index:2147483000;';
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = STYLE;
  const box = document.createElement('span');
  root.append(style, box);
  updateBadge(host, view);
  return host;
}

export function updateBadge(host: HTMLElement, view: BadgeView): void {
  const box = host.shadowRoot!.querySelector('span')!;
  box.className = view.muted ? 'b muted' : 'b';
  box.title = view.tooltip;
  box.replaceChildren(view.text);
  if (view.sub) {
    const sub = document.createElement('span');
    sub.className = 's';
    sub.textContent = view.sub;
    box.append(sub);
  }
}

/** Ensures the card can anchor an absolutely positioned badge, then appends it. */
export function attachBadge(card: HTMLElement, host: HTMLElement): void {
  const position = getComputedStyle(card).position;
  if (!position || position === 'static') card.style.position = 'relative';
  card.append(host);
}
```

- [ ] **Step 4: Write toolbar.ts**

```ts
import type { SortDir } from '../core/rank';

export interface Toolbar {
  setStats(s: { ranked: number; unknown: number; unavailable: number }): void;
  setActive(dir: SortDir | null): void;
  destroy(): void;
}

const STYLE = `
:host { all: initial; }
.bar { font: 500 13px system-ui, sans-serif; background: #fff; color: #111; border: 1px solid #c7c7c7;
  border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,.25); padding: 8px 10px; display: flex; gap: 6px;
  align-items: center; flex-wrap: wrap; max-width: 340px; }
.t { font-weight: 700; margin-right: 4px; }
button { font: inherit; border: 1px solid #0b5d1e; background: #fff; color: #0b5d1e; border-radius: 6px;
  padding: 4px 8px; cursor: pointer; }
button[aria-pressed="true"] { background: #0b5d1e; color: #fff; }
button.reset { border-color: #888; color: #444; }
.stats { flex-basis: 100%; font-size: 11px; color: #555; }
`;

export function mountToolbar(onSort: (dir: SortDir | null) => void): Toolbar {
  document.querySelectorAll('price-scout-toolbar').forEach((e) => e.remove());
  const host = document.createElement('price-scout-toolbar');
  host.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483646;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>${STYLE}</style>
    <div class="bar">
      <span class="t">Price Scout</span>
      <button data-dir="asc" aria-pressed="false">Best value first</button>
      <button data-dir="desc" aria-pressed="false">Priciest first</button>
      <button data-dir="reset" class="reset">Reset</button>
      <span class="stats"></span>
    </div>`;
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button'));
  const stats = root.querySelector('.stats')!;

  const setActive = (dir: SortDir | null) => {
    for (const b of buttons) {
      if (b.dataset.dir !== 'reset') b.setAttribute('aria-pressed', String(b.dataset.dir === dir));
    }
  };
  for (const b of buttons) {
    b.addEventListener('click', () => {
      const dir = b.dataset.dir === 'reset' ? null : (b.dataset.dir as SortDir);
      setActive(dir);
      onSort(dir);
    });
  }
  document.documentElement.append(host);

  return {
    setStats: (s) => {
      stats.textContent = `${s.ranked} ranked · ${s.unknown} unknown size · ${s.unavailable} unavailable`;
    },
    setActive,
    destroy: () => host.remove(),
  };
}
```

- [ ] **Step 5: Write controller.ts**

```ts
import type { SiteAdapter } from '../adapters/types';
import { analyzeCard } from '../core/analyze';
import { formatPer100 } from '../core/format';
import { dominantDim, sortOrder, type SortDir } from '../core/rank';
import type { CardAnalysis, RawCard } from '../core/types';
import { attachBadge, createBadge, updateBadge, type BadgeView } from './badge';
import { createReorderer, type Reorderer } from './reorder';
import { mountToolbar, type Toolbar } from './toolbar';

interface Entry {
  card: HTMLElement;
  node: Element;
  raw: RawCard;
  analysis: CardAnalysis;
  badge: HTMLElement;
}

export class ListingController {
  private entries: Entry[] = [];
  private seen = new WeakSet<Element>();
  private dir: SortDir | null = null;
  private toolbar: Toolbar | null = null;
  private readonly reorderer: Reorderer;

  constructor(private readonly adapter: SiteAdapter) {
    this.reorderer = createReorderer(adapter.reorder);
  }

  start(): void {
    this.toolbar = mountToolbar((dir) => this.setSort(dir));
    this.scan();
  }

  scan(): void {
    this.entries = this.entries.filter((e) => e.card.isConnected);
    let added = false;
    for (const el of Array.from(document.querySelectorAll(this.adapter.cardSelector))) {
      if (this.seen.has(el)) continue;
      this.seen.add(el);
      const card = el as HTMLElement;
      const raw = this.adapter.extract(card);
      const analysis = analyzeCard(raw);
      const badge = createBadge({ text: '', sub: null, tooltip: '', muted: true });
      attachBadge(card, badge);
      this.entries.push({ card, node: this.adapter.sortNode(card), raw, analysis, badge });
      added = true;
    }
    for (const e of this.entries) if (!e.badge.isConnected) attachBadge(e.card, e.badge);
    if (added) {
      this.refreshBadges();
      this.toolbar?.setStats(this.stats());
      if (this.dir) this.applySort();
    }
  }

  setSort(dir: SortDir | null): void {
    this.dir = dir;
    this.toolbar?.setActive(dir);
    if (dir) this.applySort();
    else this.reorderer.reset(this.entries.map((e) => e.node));
  }

  destroy(): void {
    this.reorderer.reset(this.entries.map((e) => e.node));
    for (const e of this.entries) e.badge.remove();
    this.entries = [];
    this.toolbar?.destroy();
    this.toolbar = null;
    this.dir = null;
  }

  private applySort(): void {
    const order = sortOrder(
      this.entries.map((e) => ({ per100: e.analysis.per100, state: e.analysis.state })),
      this.dir!,
    );
    this.reorderer.apply(this.entries.map((e) => e.node), order);
  }

  private stats() {
    const count = (s: CardAnalysis['state']) => this.entries.filter((e) => e.analysis.state === s).length;
    return { ranked: count('ranked'), unknown: count('unknown'), unavailable: count('unavailable') };
  }

  private refreshBadges(): void {
    const dominant = dominantDim(
      this.entries.flatMap((e) => (e.analysis.state === 'ranked' ? [e.analysis.quantity!.dim] : [])),
    );
    for (const e of this.entries) updateBadge(e.badge, this.view(e, dominant));
  }

  private view(e: Entry, dominant: ReturnType<typeof dominantDim>): BadgeView {
    const a = e.analysis;
    const ad = e.raw.sponsored ? 'Sponsored. ' : '';
    if (a.state === 'ranked') {
      const q = a.quantity!;
      return {
        text: formatPer100(a.per100!, q.dim, q.dim !== dominant),
        sub: e.raw.deliveryNote,
        tooltip: `${ad}${q.explanation}${a.note ? `\n${a.note}` : ''}`,
        muted: false,
      };
    }
    if (a.state === 'unavailable') return { text: 'Unavailable', sub: null, tooltip: `${ad}Not in stock`, muted: true };
    return { text: '? size', sub: e.raw.deliveryNote, tooltip: `${ad}Could not read a weight or volume`, muted: true };
  }
}
```

- [ ] **Step 6: Write main.ts**

```ts
import { pickAdapter } from '../adapters';
import { ListingController } from './controller';

let controller: ListingController | null = null;
let activeHref = '';

/** One pass: (re)build or refresh the controller for the given URL. Exported for tests. */
export function tick(url: URL = new URL(location.href)): void {
  if (url.href !== activeHref) {
    controller?.destroy();
    controller = null;
    activeHref = url.href;
  }
  const adapter = pickAdapter(url);
  if (!adapter || !adapter.isListingPage(url)) return;
  if (!controller) {
    controller = new ListingController(adapter);
    controller.start();
  } else {
    controller.scan();
  }
}

function boot(): void {
  if (document.documentElement.dataset.priceScout) return;
  document.documentElement.dataset.priceScout = '1';
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      tick();
    }, 300);
  };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('popstate', schedule);
  tick();
}

if (typeof document !== 'undefined' && pickAdapter(new URL(location.href))) boot();
```

- [ ] **Step 7: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: PASS everywhere. In the `main` test "does nothing off supported sites", `location` in jsdom is `http://localhost:3000/` so `pickAdapter` is null and `boot` never runs.

If `ListingController` Flipkart tests fail on order (React-free jsdom), debug `domSlots` first; if Amazon CSS-order test fails because `getComputedStyle(card).position` is `''`, confirm `attachBadge` handles the empty string (it does).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(content): badges, toolbar, listing controller and boot loop" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Build, live verification, docs, delivery

**Files:**
- Create: `scripts/smoke.mjs`
- Modify: `README.md`, `CONTRIBUTING.md`
- Output (not committed): `dist/`, `/mnt/data/Price-Scout-Extension/` (copy), `/mnt/data/Price-Scout-Extension.zip`

**Interfaces:**
- Consumes: `dist/content.js` from `npm run build`.
- Produces: a folder that Chrome/Brave can load with "Load unpacked".

- [ ] **Step 1: Build**

Run: `npm test && npm run build && ls -la dist && grep -c 'permissions' dist/manifest.json`
Expected: all tests PASS; `dist/content.js` and `dist/manifest.json` exist; manifest has `"permissions": []`.

- [ ] **Step 2: Write the live smoke script**

`scripts/smoke.mjs`:
```js
// Live check against the real sites using the installed Brave. Usage: BRAVE=/snap/bin/brave node scripts/smoke.mjs
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const exe = process.env.BRAVE ?? '/snap/bin/brave';
const bundle = readFileSync(new URL('../dist/content.js', import.meta.url), 'utf8');
const targets = [
  { name: 'amazon', url: 'https://www.amazon.in/s?k=sunscreen', card: '[data-component-type="s-search-result"]' },
  { name: 'flipkart', url: 'https://www.flipkart.com/search?q=shampoo', card: 'div[data-id]' },
];

const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
let failed = false;
for (const t of targets) {
  const page = await (await browser.newContext({ locale: 'en-IN', viewport: { width: 1400, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector(t.card, { timeout: 20000 });
  await page.waitForTimeout(2500);
  await page.evaluate(bundle); // same code Chrome injects as the content script
  await page.waitForSelector('price-scout-toolbar', { timeout: 10000 });
  const badges = await page.locator('price-scout-badge').count();
  await page.evaluate(() => document.querySelector('price-scout-toolbar').shadowRoot.querySelector('[data-dir="asc"]').click());
  await page.waitForTimeout(500);
  const order = await page.evaluate((sel) => {
    const cards = [...document.querySelectorAll(sel)];
    const val = (c) => {
      const t = c.querySelector('price-scout-badge')?.shadowRoot?.textContent ?? '';
      const m = t.match(/₹([\d,.]+) \/ 100/);
      return m ? parseFloat(m[1].replace(/,/g, '')) : null;
    };
    const pos = (c) => {
      const st = Number(c.style.order);
      return Number.isFinite(st) && c.style.order !== '' ? st : null;
    };
    const css = cards.some((c) => c.style.order !== '');
    const shown = css ? [...cards].sort((a, b) => pos(a) - pos(b)) : cards;
    return shown.map(val).filter((v) => v !== null);
  }, t.card);
  const sorted = order.every((v, i) => i === 0 || order[i - 1] <= v + 0.5); // badges round large values
  console.log(`${t.name}: ${badges} badges, ${order.length} ranked, ascending=${sorted}, pageerrors=${errors.length}`);
  if (errors.length) console.log(errors.slice(0, 3));
  if (!badges || order.length < 10 || !sorted || errors.length) failed = true;
  await page.screenshot({ path: `/mnt/data/Tools/_dom-probe/smoke-${t.name}.png` });
}
await browser.close();
process.exit(failed ? 1 : 0);
```

- [ ] **Step 3: Run the live smoke test**

Run: `npm run smoke`
Expected: two lines like `amazon: 48 badges, 45 ranked, ascending=true, pageerrors=0` and `flipkart: 40 badges, 40 ranked, ascending=true, pageerrors=0`, exit code 0. Open the two screenshots in `/mnt/data/Tools/_dom-probe/` and check that the toolbar and badges render and nothing overlaps badly. If a site fails, fix the adapter or controller (add a fixture + test reproducing it first), rebuild, re-run.

- [ ] **Step 4: Check real extension loading (best effort)**

Run a headed Brave with the extension, using a throwaway profile on the data disk:
```bash
node --input-type=module -e "
import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('/mnt/data/Tools/_dom-probe/profile', {
  executablePath: '/snap/bin/brave', headless: false, args: ['--no-sandbox','--disable-extensions-except=/mnt/data/Tools/price-scout-extension/dist','--load-extension=/mnt/data/Tools/price-scout-extension/dist'] });
const p = await ctx.newPage();
await p.goto('https://www.amazon.in/s?k=shampoo', { waitUntil: 'domcontentloaded' });
await p.waitForSelector('price-scout-toolbar', { timeout: 20000 }).then(() => console.log('extension content script ran'), () => console.log('toolbar did not appear'));
await ctx.close();
"
```
Expected: `extension content script ran`. If Brave's snap sandbox cannot read `/mnt/data` or blocks `--load-extension`, record that in the final report and rely on the smoke test (same bundle) plus the manifest check; do not claim the real-load check passed.

- [ ] **Step 5: Rewrite README.md**

Replace the file with (keep the badges block from the old README if present):

```markdown
# Price Scout

Sorts Amazon.in and Flipkart search results by **price per 100 g / 100 ml**, so the best value for money comes first instead of the lowest sticker price.

## What it does
- Adds a badge to every result: `₹747 / 100 g`. Hover for the maths.
- Adds a small toolbar: **Best value first**, **Priciest first**, **Reset**.
- Reads the size from Amazon's own unit price when shown, Flipkart's size line, or the title (`2 x 50 g`, `Pack of 3`, `1.5 L`, `100 ml + 50 ml free`).
- Cards whose size cannot be read are marked `? size` and listed after the ranked ones. Out-of-stock cards go last.
- Treats 1 ml as 1 g so liquids and solids share one ranking. Badges in the less common unit on a page are marked `≈`.
- Runs entirely in your browser. No permissions, no accounts, nothing is sent anywhere.

## Supported sites
Amazon.in (`/s` search pages) and Flipkart (`/search`). More sites are planned.

## Install (Chrome, Brave, Edge)
1. `npm ci && npm run build`
2. Open `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** and choose the `dist` folder.

## Develop
- `npm test`: unit and fixture tests (parser, adapters, reordering).
- `npm run build`: type-check and bundle to `dist/`.
- `npm run smoke`: loads the bundle on live Amazon.in and Flipkart pages with Brave and checks the sort.

Design: `docs/superpowers/specs/`. Plans: `docs/superpowers/plans/`.

## Limitations
- Mass and volume are compared as if 1 ml = 1 g, which is wrong for oils, honey and gels.
- Only the cards on the current page are ranked; use the site's page links to see more.
- Site markup changes can break an adapter; fixtures in `tests/fixtures` show what each one expects.

MIT licensed.
```

- [ ] **Step 6: Update CONTRIBUTING.md**

Replace the Development section with:
```markdown
Development
- `npm ci`, then `npm test` and `npm run build`.
- Load `dist/` as an unpacked extension (see README).
- A new site is one file in `src/adapters/` plus a trimmed page in `tests/fixtures/<site>/` (`node scripts/trim-fixture.mjs saved.html tests/fixtures/<site>/<query>.html`) and a test next to the others.
- Parser changes need a row in `tests/core/quantity.test.ts`.
```

- [ ] **Step 7: Final checks and commit**

Run: `npm test && npm run build && git status -s`
Then:
```bash
git add -A
git commit -m "docs: README and CONTRIBUTING describe what exists; add live smoke script" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Push the branch**

Run: `git -c credential.helper='!gh auth git-credential' push -u origin feat/unit-price-sorter`
Expected: new branch on `Student-Parv/price-scout-extension`. Do not merge or open a PR without being asked.

- [ ] **Step 9: Deliver the loadable folder**

Run:
```bash
rm -rf /mnt/data/Price-Scout-Extension /mnt/data/Price-Scout-Extension.zip
cp -r dist /mnt/data/Price-Scout-Extension
(cd /mnt/data/Price-Scout-Extension && zip -qr ../Price-Scout-Extension.zip .)
ls -la /mnt/data/Price-Scout-Extension && unzip -l /mnt/data/Price-Scout-Extension.zip | tail -4
```
Expected: the folder contains `manifest.json` and `content.js`; the zip lists the same two files at its root.

---

## Self-Review

**Spec coverage**
- Goal / success criteria 1: Task 5–6 fixture tests and Task 9 smoke (ascending order on live pages). Criterion 2 (parser ≥95% on corpus): Task 2 corpus and the ≥90% adapter-fixture thresholds; unknown never guessed (Task 2 `UNKNOWN` list). Criterion 3 (late cards): Task 8 controller test "badges and sorts cards that appear later" and boot loop.
- Sites: Tier 1 here; tiers 2–4 explicitly deferred (Global Constraints, spec Task 1 note).
- Architecture / adapter interface: Tasks 5, 6 (interface slimmed: `container()`/`deliveryNote` hooks dropped because the controller uses `document` and the delivery note lives in `RawCard`).
- Parser rules, unit table, patterns, ranges, confidence: Task 2. `mg` dropped (documented in spec amendment 1).
- Price rules (one node, strict, no concatenation): Task 3.
- Units/ranking, ≈ marker, group order: Tasks 4 and 8.
- Reordering (`css-order`, `dom-slots`): Task 7; Amazon grid verified, Flipkart rows verified.
- Product-page fallback + cache: deferred to a later plan (spec amendment 4); manifest therefore has no `storage` permission.
- UI (toolbar, badge, delivery note, popup removed): Task 8; popup deleted in Task 1.
- Testing: corpus, fixtures, live smoke: Tasks 2, 5, 6, 9.
- README/CONTRIBUTING truth: Task 9.

**Placeholder scan:** no TBD/TODO; every code step has code; the only judgment steps are the explicit "fix the cause, do not lower thresholds" instructions.

**Type consistency:** `RawCard`, `CardAnalysis`, `Quantity`, `SortDir`, `SortEntry`, `Reorderer`, `BadgeView`, `Toolbar`, `ListingController`, `SiteAdapter` names and signatures match across Tasks 2–8. `tick(url?)` is exported from `main.ts` and used by `main.test.ts`.
