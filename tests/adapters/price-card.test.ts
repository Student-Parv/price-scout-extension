import { describe, expect, it } from 'vitest';
import { zepto } from '../../src/adapters/zepto';
import { priceCardAdapter } from '../../src/adapters/price-card';
import { analyzeCard } from '../../src/core/analyze';

/** Builds a card the way React does: text pieces appended as separate nodes, which an HTML file would merge. */
function reactCard(parts: { price: string[]; mrp?: string[]; title: string; size: string }): HTMLElement {
  const el = (tag: string, attrs: Record<string, string> = {}) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };
  const text = (e: Element, pieces: string[]) => pieces.forEach((p) => e.append(document.createTextNode(p)));
  const a = el('a', { 'data-testid': 'product-card', href: '/pn/x/pvid/1' });
  const inner = el('div', { 'data-is-out-of-stock': 'false' });
  const price = el('div', { 'data-slot-id': 'EdlpPrice' });
  const sell = el('span');
  text(sell, parts.price);
  price.append(sell);
  if (parts.mrp) {
    const old = el('span', { 'data-ps-struck': '1' });
    text(old, parts.mrp);
    price.append(old);
  }
  const name = el('div', { 'data-slot-id': 'ProductName' });
  const nameSpan = el('span');
  text(nameSpan, [parts.title]);
  name.append(nameSpan);
  const pack = el('div', { 'data-slot-id': 'PackSize' });
  const packSpan = el('span');
  text(packSpan, [parts.size]);
  pack.append(packSpan);
  inner.append(price, name, pack);
  a.append(inner);
  return a;
}

describe('text split into several nodes (React) is read as one piece', () => {
  it('Zepto: "₹" + "99" is the price ₹99, and "1 pc (" + "245 ml" + ")" is a size', () => {
    const card = reactCard({ price: ['₹', '99'], title: 'LUX Orchid Obsession Bodywash', size: '1 pc (245 ml)' });
    expect(card.querySelector('[data-slot-id="EdlpPrice"] span')!.childNodes).toHaveLength(2);
    const raw = zepto.extract(card);
    expect(raw.priceText).toBe('₹99');
    const a = analyzeCard(raw);
    expect(a.state).toBe('ranked');
    expect(a.per100).toBeCloseTo(40.41, 1);
  });

  it('skips the struck old price even when it is split too', () => {
    const card = reactCard({ price: ['₹', '387'], mrp: ['₹', '580'], title: 'Dove Deep Moisture Body Wash', size: '1 pc (825 ml)' });
    expect(zepto.extract(card).priceText).toBe('₹387');
  });

  it('a size split into pieces ("50 ", "g") is read as 50 g', () => {
    const generic = priceCardAdapter({ id: 'x', hosts: [], isListing: () => true });
    const card = reactCard({ price: ['₹', '120'], title: 'Some Sunscreen Lotion SPF 50', size: '' });
    const holder = document.createElement('div');
    holder.append(document.createTextNode('50 '), document.createTextNode('g'));
    card.firstElementChild!.append(holder);
    const raw = generic.extract(card);
    expect(raw.sizeText).toBe('50 g');
    expect(analyzeCard(raw).per100).toBeCloseTo(240, 1);
  });

  it('text pieces separated by an element are not glued together', () => {
    const generic = priceCardAdapter({ id: 'x', hosts: [], isListing: () => true });
    const card = reactCard({ price: ['₹', '60'], title: 'Atta Premium Whole Wheat', size: '' });
    const holder = document.createElement('div');
    holder.append(document.createTextNode('50 g'), document.createElement('span'), document.createTextNode('extra'));
    card.firstElementChild!.append(holder);
    expect(generic.extract(card).sizeText).toBe('50 g');
  });

  it('does not change the page: text nodes stay as they were', () => {
    const card = reactCard({ price: ['₹', '99'], title: 'LUX Orchid Obsession Bodywash', size: '1 pc (245 ml)' });
    const span = card.querySelector('[data-slot-id="EdlpPrice"] span')!;
    const nodes = Array.from(span.childNodes);
    zepto.extract(card);
    expect(Array.from(span.childNodes)).toEqual(nodes);
  });
});
