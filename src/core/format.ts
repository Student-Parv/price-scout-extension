import type { Dim } from './types';

export function formatPer100(per100: number, dim: Dim, crossUnit: boolean): string {
  const amount = per100 < 100 ? per100.toFixed(2) : Math.round(per100).toLocaleString('en-IN');
  return `${crossUnit ? '≈ ' : ''}₹${amount} / 100 ${dim === 'mass' ? 'g' : 'ml'}`;
}
