/** Message the background worker sends to a page when the toolbar icon is clicked. */
export const RETRY_MESSAGE = 'price-scout:retry';

export interface RetryStatus {
  cards: number;
  ranked: number;
  unknown: number;
  unavailable: number;
}

export function isRetryStatus(value: unknown): value is RetryStatus {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return ['cards', 'ranked', 'unknown', 'unavailable'].every((k) => typeof v[k] === 'number');
}
