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
