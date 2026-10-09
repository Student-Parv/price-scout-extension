import { describe, expect, it } from 'vitest';
import { parseQuantity } from '../../src/core/quantity';

type Case = [title: string, value: number, dim: 'mass' | 'volume'];

const KNOWN: Case[] = [
  ['Minimalist Sunscreen SPF 50 PA++++ with Niacinamide | Face Sunscreen for Men & Women | 30gm', 30, 'mass'],
  ['Pilgrim Australian Tea Tree Non-Drying Anti-Dandruff Shampoo - 200ml', 200, 'volume'],
  ['Dove Intense Repair Shampoo 1 L|| Repairs Dry and Damaged', 1000, 'volume'],
  ['TRESemmé Keratin Smooth Shampoo 340 ML | 72H Frizz Control', 340, 'volume'],
  ['Natureland Organics Whole Wheat Flour Bag, 5 kg', 5000, 'mass'],
  ['Patanjali Traditional Whole Wheat Chakki Atta 5kg - 100% Atta 0% Maida', 5000, 'mass'],
  ['Original | Potato Chips | On-the-Go Can | 141g', 141, 'mass'],
  ['Fortune Sunlite Refined Sunflower Oil 1 Litre Pouch', 1000, 'volume'],
  ['Basmati Rice 5 Kg', 5000, 'mass'],
  ['Coca-Cola 2.25 L', 2250, 'volume'],
  ['Groundnut Oil 1,000 ml', 1000, 'volume'],
  ['Ghee 500 ml (0.5 L)', 500, 'volume'],
  ['Protein Powder 2lbs (907g)', 907.18, 'mass'],
  ['Peanut Butter 1 lb', 453.592, 'mass'],
  ['Honey 12 fl oz', 354.882, 'volume'],
  ['Dairy Milk 4×50g', 200, 'mass'],
  ['Pepsi 6 x 250 ml', 1500, 'volume'],
  ['Garnier Face Wash 2 x 100 ml', 200, 'volume'],
  ['Dettol Handwash Refill 750ml x 2', 1500, 'volume'],
  ['Lays 52g x 6 packs', 312, 'mass'],
  ['Mamaearth Face Wash Pack of 2, 100 g', 200, 'mass'],
  ['Himalaya Neem Face Wash 150ml (Pack of 3)', 450, 'volume'],
  ['Lakme Serum 100ml + 50ml free', 150, 'volume'],
  ['Tide Detergent 2 kg + 500 g free', 2500, 'mass'],
  ['Surf Excel 1 kg (Pack of 1)', 1000, 'mass'],
  ['Soap 3 x 75 g Pack of 3', 225, 'mass'],
  ['4 x 26.75 g', 107, 'mass'],
  ['Homemade Ready to Fry Dry Potato Chips | Especially for Fasting, Snacks | Pack of 900 Grams', 900, 'mass'],
  ['Set of 250 ml bottle', 250, 'volume'],
  ['1.2 L', 1200, 'volume'],
  ['SPF 50 - 100 ml', 100, 'volume'],
  ['Shampoo 200 millilitres', 200, 'volume'],
  ['Oil 2 ltrs', 2000, 'volume'],
  ['Rice 10 kgs', 10000, 'mass'],
  ['Atta 500 gms', 500, 'mass'],
  ['Atta 500 gm', 500, 'mass'],
];

const UNKNOWN: string[] = [
  'Lay’s Hot and Sweet Chilli, 52.9g/ 48g /58g (Weight may vary)',
  'Lays Potato Chips - Classic Salted, 80gm/82gm (Weight May Vary)',
  'Combo of Shampoo 200ml and Conditioner 180ml',
  'Sunscreen 50-100 ml',
  'Sunscreen 50ml - 100ml',
  'Vitamin C 500mg 60 tablets',
  'SPF 50 PA++++ Sunscreen',
  'Pringles',
  '500',
  '',
];

describe('parseQuantity', () => {
  it.each(KNOWN)('%s', (title, value, dim) => {
    const q = parseQuantity(title);
    expect(q).not.toBeNull();
    expect(q!.dim).toBe(dim);
    expect(q!.value).toBeCloseTo(value, 2);
  });

  it.each(UNKNOWN)('is unknown for %j', (title) => {
    expect(parseQuantity(title)).toBeNull();
  });

  it('handles null and undefined', () => {
    expect(parseQuantity(null)).toBeNull();
    expect(parseQuantity(undefined)).toBeNull();
  });

  it('marks plain sizes high confidence and pack/bonus medium', () => {
    expect(parseQuantity('Shampoo 200ml')!.confidence).toBe('high');
    expect(parseQuantity('Shampoo 200ml')!.source).toBe('text');
    expect(parseQuantity('4 x 50 g')!.confidence).toBe('high');
    expect(parseQuantity('4 x 50 g')!.source).toBe('pack');
    expect(parseQuantity('Wash 100 g Pack of 3')!.confidence).toBe('medium');
    expect(parseQuantity('Serum 100ml + 50ml free')!.source).toBe('bonus');
  });

  it('explains the maths for packs', () => {
    expect(parseQuantity('Pepsi 6 x 250 ml')!.explanation).toBe('6 × 250 ml = 1500 ml');
  });
});
