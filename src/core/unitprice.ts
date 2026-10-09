import type { Quantity } from './types';
import { NUM_PATTERN, formatAmount, lookupUnit, toNumber } from './units';

const UNIT_PRICE_RE = new RegExp(`₹\\s*(${NUM_PATTERN})\\s*/\\s*(${NUM_PATTERN})?\\s*([A-Za-z]+)`, 'g');

export interface UnitPrice {
  /** ₹ per `perAmount` of `unit`. */
  price: number;
  perAmount: number;
  unit: string;
}

/** Reads the site's own unit price, e.g. "(₹746.67₹746.67/100 g)". Count- and month-based ones are ignored. */
export function parseUnitPrice(text: string): UnitPrice | null {
  for (const m of text.matchAll(UNIT_PRICE_RE)) {
    const unit = m[3].toLowerCase();
    if (!lookupUnit(unit)) continue;
    return { price: toNumber(m[1]), perAmount: m[2] ? toNumber(m[2]) : 1, unit };
  }
  return null;
}

export function quantityFromUnitPrice(sellingPrice: number, up: UnitPrice): Quantity | null {
  const def = lookupUnit(up.unit);
  if (!def || !(up.price > 0) || !(sellingPrice > 0) || !(up.perAmount > 0)) return null;
  const value = (sellingPrice / up.price) * up.perAmount * def.factor;
  if (!(value > 0) || value > 1_000_000) return null;
  const per = up.perAmount === 1 ? up.unit : `${up.perAmount} ${up.unit}`;
  return {
    value: Math.round(value * 1e4) / 1e4,
    dim: def.dim,
    confidence: 'high',
    source: 'site-unit-price',
    explanation: `₹${sellingPrice} at ₹${up.price}/${per} = ${formatAmount(value)} ${def.label}`,
  };
}
