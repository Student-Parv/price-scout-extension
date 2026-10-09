import { amazon } from './amazon';
import type { SiteAdapter } from './types';

export const ADAPTERS: SiteAdapter[] = [amazon];

export function pickAdapter(url: URL): SiteAdapter | null {
  return ADAPTERS.find((a) => a.matches(url)) ?? null;
}
