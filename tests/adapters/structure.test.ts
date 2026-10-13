import { describe, expect, it } from 'vitest';
import { findCardsByPrice, isPriceLeaf } from '../../src/adapters/structure';

const card = (title: string, mrp: string, price: string) =>
  `<div class="card-wrap"><div><img><span>${title}</span><div class="row"><span>${mrp}</span><span>${price}</span></div></div></div>`;

describe('isPriceLeaf', () => {
  it('accepts a bare rupee amount in an element without children', () => {
    document.body.innerHTML = '<i id="a">₹214</i><i id="b">₹ 1,299.50</i><i id="c">214</i><i id="d"><b>₹5</b></i><i id="e">₹5 off</i>';
    const ok = (id: string) => isPriceLeaf(document.getElementById(id)!);
    expect([ok('a'), ok('b'), ok('c'), ok('d'), ok('e')]).toEqual([true, true, false, false, false]);
  });
});

describe('findCardsByPrice', () => {
  it('finds one card per product, not the price row inside it', () => {
    document.body.innerHTML =
      '<main><div id="grid">' +
      card('Minimalist Sunscreen SPF 50 Lightweight', '₹249', '₹214') +
      card('Dermatouch Sunscreen SPF 50 Multivitamin', '₹349', '₹175') +
      card('Biotique Sunscreen Sun Shield Sandalwood', '₹325', '₹249') +
      card('Dot and Key Sunscreen Super Bright Vit C', '₹499', '₹257') +
      '</div></main>';
    const cards = findCardsByPrice(document);
    expect(cards).toHaveLength(4);
    expect(cards.every((c) => c.className === 'card-wrap')).toBe(true);
  });

  it('handles cards arranged in rows of four', () => {
    const row = (n: number) =>
      `<div class="row4">${[1, 2, 3, 4].map((i) => card(`Product number ${n}${i} with a long name`, '₹100', '₹90')).join('')}</div>`;
    document.body.innerHTML = `<main>${row(1)}${row(2)}${row(3)}</main>`;
    const cards = findCardsByPrice(document);
    expect(cards).toHaveLength(12);
    expect(cards.every((c) => c.parentElement!.className === 'row4')).toBe(true);
  });

  it('returns cards in document order', () => {
    document.body.innerHTML =
      '<div>' + ['Alpha product name here', 'Bravo product name here', 'Charlie product name here'].map((t) => card(t, '₹9', '₹8')).join('') + '</div>';
    expect(findCardsByPrice(document).map((c) => c.textContent)).toEqual([
      expect.stringContaining('Alpha'),
      expect.stringContaining('Bravo'),
      expect.stringContaining('Charlie'),
    ]);
  });

  it('accepts short titles such as "Wheat Atta"', () => {
    document.body.innerHTML = '<div>' + ['Wheat Atta', 'Basmati Rice', 'Toor Dal', 'Besan'].map((t) => card(t, '₹120', '₹99')).join('') + '</div>';
    expect(findCardsByPrice(document)).toHaveLength(4);
  });

  it('does not return a wrapper that contains other cards (a row with a short-titled first card)', () => {
    document.body.innerHTML =
      '<div id="list"><div class="wrap"><div class="r">' +
      ['Wheat Atta', 'Chakki Fresh Atta Premium', 'Superior MP Atta Pack', 'Sharbati Atta'].map((t) => card(t, '₹120', '₹99')).join('') +
      '</div></div><div class="wrap"><div class="r">' +
      ['Toor Dal Premium Pack', 'Moong Dal Washed Pack', 'Chana Dal Gold Pack', 'Urad Dal Whole Pack'].map((t) => card(t, '₹120', '₹99')).join('') +
      '</div></div></div>';
    const cards = findCardsByPrice(document);
    expect(cards).toHaveLength(8);
    expect(cards.every((c) => c.className === 'card-wrap')).toBe(true);
    expect(cards.some((c) => cards.some((o) => o !== c && c.contains(o)))).toBe(false);
  });

  it('ignores a price list with no titles (e.g. a cart total)', () => {
    document.body.innerHTML = '<ul><li><b>₹10</b></li><li><b>₹20</b></li><li><b>₹30</b></li></ul>';
    expect(findCardsByPrice(document)).toEqual([]);
    document.body.innerHTML = '<ul><li><b>₹10</b><i>Add</i></li><li><b>₹20</b><i>Add</i></li><li><b>₹30</b><i>Add</i></li></ul>';
    expect(findCardsByPrice(document)).toEqual([]);
  });

  it('needs at least three cards to recognise a grid (two results are not detected)', () => {
    document.body.innerHTML = '<div>' + card('Only product one here', '₹9', '₹8') + card('Only product two here', '₹9', '₹8') + '</div>';
    expect(findCardsByPrice(document)).toEqual([]);
  });
});
