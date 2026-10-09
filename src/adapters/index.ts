import { amazon } from './amazon';
import { flipkart } from './flipkart';
import type { SiteAdapter } from './types';

export const ADAPTERS: SiteAdapter[] = [amazon, flipkart];

export function pickAdapter(url: URL): SiteAdapter | null {
  return ADAPTERS.find((a) => a.matches(url)) ?? null;
}
