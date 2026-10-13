import { amazon } from './amazon';
import { bigbasket } from './bigbasket';
import { blinkit } from './blinkit';
import { dmart } from './dmart';
import { flipkart } from './flipkart';
import { flipkartMinutes } from './flipkart-minutes';
import { instamart } from './instamart';
import type { SiteAdapter } from './types';
import { zepto } from './zepto';

/** Order matters: Flipkart Minutes shares flipkart.com with the normal site and is told apart by its URL. */
export const ADAPTERS: SiteAdapter[] = [flipkartMinutes, flipkart, amazon, dmart, blinkit, zepto, bigbasket, instamart];

export function pickAdapter(url: URL): SiteAdapter | null {
  return ADAPTERS.find((a) => a.matches(url)) ?? null;
}
