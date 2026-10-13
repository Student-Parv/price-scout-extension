import { amazon } from './amazon';
import { dmart } from './dmart';
import { flipkart } from './flipkart';
import { flipkartMinutes } from './flipkart-minutes';
import type { SiteAdapter } from './types';

/** Order matters: Flipkart Minutes shares flipkart.com with the normal site and is told apart by its URL. */
export const ADAPTERS: SiteAdapter[] = [flipkartMinutes, flipkart, amazon, dmart];

export function pickAdapter(url: URL): SiteAdapter | null {
  return ADAPTERS.find((a) => a.matches(url)) ?? null;
}
