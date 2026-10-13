import { amazon } from './amazon';
import { amazonNow } from './amazon-now';
import { bigbasket } from './bigbasket';
import { blinkit } from './blinkit';
import { dmart } from './dmart';
import { flipkart } from './flipkart';
import { flipkartMinutes } from './flipkart-minutes';
import { instamart } from './instamart';
import type { SiteAdapter } from './types';
import { zepto } from './zepto';

/** Order matters: Flipkart Minutes and Amazon Now share a domain with the normal site and are told apart by URL. */
export const ADAPTERS: SiteAdapter[] = [flipkartMinutes, flipkart, amazonNow, amazon, dmart, blinkit, zepto, bigbasket, instamart];

export function pickAdapter(url: URL): SiteAdapter | null {
  return ADAPTERS.find((a) => a.matches(url)) ?? null;
}
