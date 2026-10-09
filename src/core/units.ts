import type { Dim } from './types';

export interface UnitDef {
  dim: Dim;
  /** Multiply an amount in this unit by `factor` to get grams or millilitres. */
  factor: number;
  label: 'g' | 'ml';
}

const mass = (factor: number): UnitDef => ({ dim: 'mass', factor, label: 'g' });
const volume = (factor: number): UnitDef => ({ dim: 'volume', factor, label: 'ml' });

/** `mg` is deliberately absent: on listings it is a dose, not a pack size. */
export const UNITS: Record<string, UnitDef> = {
  g: mass(1), gm: mass(1), gms: mass(1), gram: mass(1), grams: mass(1),
  kg: mass(1000), kgs: mass(1000), kilo: mass(1000), kilos: mass(1000),
  kilogram: mass(1000), kilograms: mass(1000),
  lb: mass(453.592), lbs: mass(453.592), oz: mass(28.3495),
  ml: volume(1), millilitre: volume(1), millilitres: volume(1),
  milliliter: volume(1), milliliters: volume(1),
  l: volume(1000), ltr: volume(1000), ltrs: volume(1000),
  litre: volume(1000), litres: volume(1000), liter: volume(1000), liters: volume(1000),
  floz: volume(29.5735),
};

/** Alternation of every unit token, longest first so `kgs` wins over `kg`. */
export const UNIT_PATTERN = Object.keys(UNITS)
  .sort((a, b) => b.length - a.length)
  .join('|');

/** 1,000 / 1,29,999 / 34.5 / 500 */
export const NUM_PATTERN = '(?:\\d{1,3}(?:,\\d{2,3})+|\\d+)(?:\\.\\d+)?';

export function toNumber(raw: string): number {
  return parseFloat(raw.replace(/,/g, ''));
}

export function lookupUnit(token: string): UnitDef | null {
  return UNITS[token.toLowerCase()] ?? null;
}

export function canonical(amount: number, unit: UnitDef): number {
  return amount * unit.factor;
}

export function formatAmount(value: number): string {
  return String(Math.round(value * 100) / 100);
}
