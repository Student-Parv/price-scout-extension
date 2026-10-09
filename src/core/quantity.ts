import type { Dim, Quantity } from './types';
import { NUM_PATTERN, UNIT_PATTERN, canonical, formatAmount, lookupUnit, toNumber } from './units';

const BEFORE = '(?<![\\w.,])';
const QTY = `(${NUM_PATTERN})\\s*(${UNIT_PATTERN})\\b`;

const QTY_RE = new RegExp(BEFORE + QTY, 'gi');
/** 4 x 26.75 g */
const COUNT_FIRST_RE = new RegExp(`${BEFORE}(\\d{1,3})\\s*x\\s*${QTY}`, 'i');
/** 26.75 g x 4 */
const COUNT_AFTER_RE = new RegExp(
  `${BEFORE}${QTY}\\s*x\\s*(\\d{1,3})\\b(?!\\s*(?:${UNIT_PATTERN})\\b)`,
  'i',
);
/** 100 ml + 50 ml free */
const BONUS_RE = new RegExp(`${BEFORE}${QTY}\\s*\\+\\s*${QTY}`, 'i');
/** 50-100 ml, 50 ml - 100 ml (a bare "50 - 100 ml" with spaces is not treated as a range) */
const RANGE_RE = new RegExp(
  `${BEFORE}(?:${NUM_PATTERN}\\s*(?:${UNIT_PATTERN})\\s*-\\s*${NUM_PATTERN}\\s*(?:${UNIT_PATTERN})\\b` +
    `|${NUM_PATTERN}-${NUM_PATTERN}\\s*(?:${UNIT_PATTERN})\\b)`,
  'i',
);
const PACK_RE =
  /\b(?:pack of|set of|combo of)\s*(\d{1,3})\b|\b(\d{1,3})\s*(?:-\s*)?(?:pack|packs|pcs|pieces|units|count)\b/i;

interface Part {
  value: number;
  dim: Dim;
  raw: string;
}

function normalise(s: string): string {
  return s
    .replace(/[×✕✖]/g, 'x')
    .replace(/[–—]/g, '-')
    .replace(/fl\.?\s*oz\.?/gi, 'floz')
    .replace(/(?<=\d)\s*\*\s*(?=\d)/g, ' x ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toPart(amountRaw: string, unitRaw: string): Part | null {
  const def = lookupUnit(unitRaw);
  if (!def) return null;
  const amount = toNumber(amountRaw);
  if (!(amount > 0)) return null;
  return { value: canonical(amount, def), dim: def.dim, raw: `${amountRaw} ${unitRaw}` };
}

const same = (a: number, b: number) => Math.abs(a - b) <= 0.005 * Math.max(a, b);
const label = (dim: Dim) => (dim === 'mass' ? 'g' : 'ml');

function make(
  value: number,
  dim: Dim,
  confidence: Quantity['confidence'],
  source: Quantity['source'],
  explanation: string,
): Quantity | null {
  if (!(value > 0) || value > 1_000_000) return null;
  return { value: Math.round(value * 1e4) / 1e4, dim, confidence, source, explanation };
}

function multiply(unit: Part, count: number, parts: Part[]): Quantity | null {
  const total = unit.value * count;
  // Another, different size in the same string (e.g. "(408 g)" is fine, "80 g" is not).
  if (parts.some((p) => !same(p.value, unit.value) && !same(p.value, total))) return null;
  return make(total, unit.dim, 'high', 'pack', `${count} × ${unit.raw} = ${formatAmount(total)} ${label(unit.dim)}`);
}

export function parseQuantity(input: string | null | undefined): Quantity | null {
  if (!input) return null;
  const text = normalise(input);
  if (!text || RANGE_RE.test(text)) return null;

  const parts: Part[] = [];
  for (const m of text.matchAll(QTY_RE)) {
    const p = toPart(m[1], m[2]);
    if (p) parts.push(p);
  }

  const cf = COUNT_FIRST_RE.exec(text);
  if (cf) {
    const unit = toPart(cf[2], cf[3]);
    if (unit) return multiply(unit, Number(cf[1]), parts);
  }
  const ca = COUNT_AFTER_RE.exec(text);
  if (ca) {
    const unit = toPart(ca[1], ca[2]);
    if (unit) return multiply(unit, Number(ca[3]), parts);
  }

  const bonus = BONUS_RE.exec(text);
  if (bonus) {
    const a = toPart(bonus[1], bonus[2]);
    const b = toPart(bonus[3], bonus[4]);
    if (!a || !b || a.dim !== b.dim) return null;
    const total = a.value + b.value;
    if (parts.some((p) => !same(p.value, a.value) && !same(p.value, b.value) && !same(p.value, total))) return null;
    return make(total, a.dim, 'medium', 'bonus', `${a.raw} + ${b.raw} = ${formatAmount(total)} ${label(a.dim)}`);
  }

  if (parts.length === 0) return null;
  const first = parts[0];
  if (parts.some((p) => p.dim !== first.dim || !same(p.value, first.value))) return null;

  const pack = PACK_RE.exec(text);
  const n = pack ? Number(pack[1] ?? pack[2]) : 1;
  if (n > 1) {
    const total = first.value * n;
    return make(total, first.dim, 'medium', 'pack', `${n} × ${first.raw} = ${formatAmount(total)} ${label(first.dim)}`);
  }
  return make(first.value, first.dim, 'high', 'text', `${first.raw} = ${formatAmount(first.value)} ${label(first.dim)}`);
}
