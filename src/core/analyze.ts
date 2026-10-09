import type { CardAnalysis, Quantity, RawCard } from './types';
import { parsePrice } from './price';
import { parseQuantity } from './quantity';
import { parseUnitPrice, quantityFromUnitPrice } from './unitprice';

const DISAGREE = 0.03;

/** Ranking treats 1 ml as 1 g, so the same number in ml and g is not a disagreement. */
function agree(a: Quantity, b: Quantity): boolean {
  return Math.abs(a.value - b.value) <= DISAGREE * Math.max(a.value, b.value);
}

export function analyzeCard(raw: RawCard): CardAnalysis {
  const price = parsePrice(raw.priceText);
  if (raw.outOfStock) return { state: 'unavailable', price, quantity: null, per100: null, note: null };
  if (price === null) return { state: 'unknown', price: null, quantity: null, per100: null, note: null };

  const up = raw.unitPriceText ? parseUnitPrice(raw.unitPriceText) : null;
  const fromSite = up ? quantityFromUnitPrice(price, up) : null;
  const fromText = (raw.sizeText ? parseQuantity(raw.sizeText) : null) ?? parseQuantity(raw.title);

  const quantity = fromSite ?? fromText;
  if (!quantity) return { state: 'unknown', price, quantity: null, per100: null, note: null };

  const note =
    fromSite && fromText && !agree(fromSite, fromText)
      ? `Title says ${fromText.explanation}; using the site's unit price.`
      : null;
  return { state: 'ranked', price, quantity, per100: (price / quantity.value) * 100, note };
}
