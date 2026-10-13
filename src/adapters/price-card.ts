import { parseQuantity } from '../core/quantity';
import { findCardsByPrice } from './structure';
import type { SiteAdapter } from './types';
import { clean, isStruck } from './types';

const RUPEE_PRICE = /^₹\s?\d[\d,]*(\.\d+)?$/;
/** Some sites draw the ₹ with CSS, so the page text is just the number. */
const BARE_PRICE = /^\d[\d,]*(\.\d+)?$/;
/** Text that is a badge or button label, never a title or a size. */
const NOISE = /^(ad|add|\d+%\s*off|₹\s?\d+\s*off|best\s*seller|notify me|sold out|out of stock|\d+\s*mins?)$/i;
const UNAVAILABLE = /out of stock|sold out|notify me|currently unavailable/i;

export interface PriceCardConfig {
  id: string;
  hosts: string[];
  /** Extra condition on the URL (e.g. Flipkart Minutes is flipkart.com with marketplace=HYPERLOCAL). */
  match?: (url: URL) => boolean;
  isListing: (url: URL) => boolean;
  reorder?: SiteAdapter['reorder'];
  /** How prices appear in the page text; default "rupee" (₹214). "bare" is a plain number (214). */
  priceStyle?: 'rupee' | 'bare';
  /** Finds the cards from a stable hook when the site has one; default: from the prices (rupee style only). */
  cards?: (doc: ParentNode) => Element[];
  /** Stable hooks some sites expose (e.g. Zepto's data-slot-id): used when present, the text heuristics otherwise. */
  selectors?: { title?: string; size?: string; outOfStock?: string };
}

interface Run {
  text: string;
  el: Element;
}

/**
 * Every non-empty piece of text in the card with the element it sits in (text may share an element with an icon).
 * Adjacent text nodes are joined: React writes "₹" and "99" as two nodes, which a saved page would merge.
 */
function textRuns(card: Element): Run[] {
  const walker = card.ownerDocument.createTreeWalker(card, 4 /* SHOW_TEXT */);
  const raw: { node: Node; text: string; el: Element }[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.parentElement) raw.push({ node: n, text: n.textContent ?? '', el: n.parentElement });
  }
  const joined: { text: string; el: Element }[] = [];
  let last: Node | null = null;
  for (const r of raw) {
    const previous = joined[joined.length - 1];
    if (previous && last !== null && r.node.previousSibling === last) previous.text += r.text;
    else joined.push({ text: r.text, el: r.el });
    last = r.node;
  }
  return joined
    .map((r) => ({ text: r.text.replace(/\s+/g, ' ').trim(), el: r.el }))
    .filter((r) => r.text);
}

/**
 * Adapter for sites whose class names are generated (React Native Web, styled components, Tailwind) but whose
 * cards all look alike: a title, a size line, a struck-through old price and the selling price.
 * Cards are found from their prices; the first price that is not struck through is the selling price, the
 * longest text is the title, and the size is the first short text that reads as a quantity.
 */
export function priceCardAdapter(config: PriceCardConfig): SiteAdapter {
  const PRICE = config.priceStyle === 'bare' ? BARE_PRICE : RUPEE_PRICE;
  const hook = (card: Element, selector: string | undefined) => (selector ? clean(card.querySelector(selector)) : '');
  return {
    id: config.id,
    matches: (url) => config.hosts.includes(url.hostname) && (config.match?.(url) ?? true),
    isListingPage: config.isListing,
    findCards: (doc) => (config.cards ? config.cards(doc) : findCardsByPrice(doc)),
    sortNode: (card) => card,
    reorder: config.reorder ?? 'dom-slots',
    extract(card) {
      const runs = textRuns(card);
      const priceRun = runs.find((r) => PRICE.test(r.text) && !isStruck(r.el));
      const texts = runs.filter((r) => !PRICE.test(r.text) && !NOISE.test(r.text)).map((r) => r.text);
      const title = hook(card, config.selectors?.title) || texts.reduce((best, t) => (t.length > best.length ? t : best), '');
      const sizeText =
        hook(card, config.selectors?.size) ||
        texts.find((t) => t !== title && t.length <= 40 && parseQuantity(t) !== null) ||
        null;
      const priceText = priceRun?.text ?? null;
      const flagged = config.selectors?.outOfStock ? card.matches(config.selectors.outOfStock) || !!card.querySelector(config.selectors.outOfStock) : false;
      return {
        title,
        sizeText,
        priceText,
        unitPriceText: null,
        deliveryNote: null,
        href: card.querySelector('a[href]')?.getAttribute('href') ?? card.closest('a[href]')?.getAttribute('href') ?? null,
        sponsored: runs.some((r) => /^ad$/i.test(r.text)),
        outOfStock: flagged || (priceText === null && UNAVAILABLE.test(clean(card))),
      };
    },
  };
}
