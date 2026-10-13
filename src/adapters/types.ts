import type { RawCard } from '../core/types';

export interface SiteAdapter {
  id: string;
  matches(url: URL): boolean;
  isListingPage(url: URL): boolean;
  /** All product cards currently on the page, in document order. */
  findCards(doc: ParentNode): Element[];
  extract(card: Element): RawCard;
  /** The element to reorder for this card (usually the card itself). */
  sortNode(card: Element): Element;
  reorder: 'css-order' | 'dom-slots';
}

/** Adapters whose cards are found with a plain CSS selector also expose it (used by tests). */
export type SelectorAdapter = SiteAdapter & { cardSelector: string };

export const clean = (el: Element | null | undefined): string =>
  el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

/**
 * True when the element (or an ancestor) is drawn struck through, i.e. an old price.
 * Saved test pages have no stylesheet, so they carry a `data-ps-struck` marker written when they were captured.
 */
export function isStruck(el: Element): boolean {
  if (el.closest('[data-ps-struck]')) return true;
  const view = el.ownerDocument.defaultView;
  let node: Element | null = el;
  while (node) {
    if (view?.getComputedStyle(node).textDecorationLine?.includes('line-through')) return true;
    node = node.parentElement;
  }
  return false;
}

/** True when any element inside `el` (or `el` itself) is drawn struck through, e.g. a wrapper around an old price. */
export function hasStruck(el: Element): boolean {
  return isStruck(el) || Array.from(el.querySelectorAll('*')).some(isStruck);
}
