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
