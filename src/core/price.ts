import { NUM_PATTERN, toNumber } from './units';

const STRICT = new RegExp(`^(?:₹|rs\\.?|inr)?\\s*(${NUM_PATTERN})\\.?$`, 'i');

/** Parses the text of ONE selling-price node. Anything else (ranges, offers, two amounts) is null. */
export function parsePrice(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = STRICT.exec(text.replace(/ /g, ' ').trim());
  if (!m) return null;
  const value = toNumber(m[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}
