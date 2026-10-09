export type Dim = 'mass' | 'volume';
export type Confidence = 'high' | 'medium';
export type QuantitySource = 'site-unit-price' | 'text' | 'pack' | 'bonus';

export interface Quantity {
  /** Canonical amount: grams for mass, millilitres for volume. */
  value: number;
  dim: Dim;
  confidence: Confidence;
  source: QuantitySource;
  /** Human-readable maths, shown in the badge tooltip. */
  explanation: string;
}

/** What an adapter reads off one result card. All text is already trimmed. */
export interface RawCard {
  title: string;
  /** Dedicated size line when the site has one (Flipkart: "4 x 102 g"). */
  sizeText: string | null;
  /** Text of the selling-price node only, e.g. "₹224". */
  priceText: string | null;
  /** The site's own unit price, e.g. "(₹746.67₹746.67/100 g)". */
  unitPriceText: string | null;
  deliveryNote: string | null;
  href: string | null;
  sponsored: boolean;
  outOfStock: boolean;
}

export type CardState = 'ranked' | 'unknown' | 'unavailable';

export interface CardAnalysis {
  state: CardState;
  price: number | null;
  quantity: Quantity | null;
  /** ₹ per 100 g (mass) or per 100 ml (volume). */
  per100: number | null;
  /** Extra tooltip line, e.g. when title and site unit price disagree. */
  note: string | null;
}
