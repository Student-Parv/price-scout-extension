import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { amazon } from '../../src/adapters/amazon';
import { flipkart } from '../../src/adapters/flipkart';
import { analyzeCard } from '../../src/core/analyze';
import { ListingController } from '../../src/content/controller';
import { mountFixture } from '../helpers';

const toolbar = () => document.querySelector('price-scout-toolbar') as HTMLElement | null;
const click = (dir: string) =>
  (toolbar()!.shadowRoot!.querySelector(`[data-dir="${dir}"]`) as HTMLButtonElement).click();

describe('ListingController on the Amazon fixture', () => {
  let c: ListingController;
  beforeEach(() => {
    mountFixture('amazon/sunscreen');
    c = new ListingController(amazon);
    c.start();
  });
  afterEach(() => c.destroy());

  it('puts one badge on every card and mounts the toolbar', () => {
    const cards = document.querySelectorAll(amazon.cardSelector);
    expect(document.querySelectorAll('price-scout-badge')).toHaveLength(cards.length);
    expect(toolbar()).not.toBeNull();
  });

  it('shows the per-100 value and the ≈ marker for the minority dimension', () => {
    const first = document.querySelector(amazon.cardSelector)!;
    const badge = first.querySelector('price-scout-badge')!.shadowRoot!.textContent!;
    expect(badge).toContain('₹747 / 100 g');
    const texts = Array.from(document.querySelectorAll('price-scout-badge')).map((b) => b.shadowRoot!.textContent!);
    expect(texts.some((t) => t.includes('≈') && t.includes('/ 100 ml'))).toBe(true);
  });

  it('sorts ascending by CSS order, ranked first', () => {
    click('asc');
    const cards = Array.from(document.querySelectorAll<HTMLElement>(amazon.cardSelector));
    const shown = cards
      .sort((a, b) => Number(a.style.order) - Number(b.style.order))
      .map((el) => analyzeCard(amazon.extract(el)));
    const ranked = shown.filter((a) => a.state === 'ranked').map((a) => a.per100!);
    expect(ranked.length).toBeGreaterThan(30);
    expect([...ranked].sort((a, b) => a - b)).toEqual(ranked);
    const firstNonRanked = shown.findIndex((a) => a.state !== 'ranked');
    if (firstNonRanked >= 0) expect(shown.slice(firstNonRanked).every((a) => a.state !== 'ranked')).toBe(true);
  });

  it('sorts descending and resets', () => {
    click('desc');
    const cards = Array.from(document.querySelectorAll<HTMLElement>(amazon.cardSelector));
    const ranked = cards
      .sort((a, b) => Number(a.style.order) - Number(b.style.order))
      .map((el) => analyzeCard(amazon.extract(el)))
      .filter((a) => a.state === 'ranked')
      .map((a) => a.per100!);
    expect([...ranked].sort((a, b) => b - a)).toEqual(ranked);
    click('reset');
    expect(Array.from(document.querySelectorAll<HTMLElement>(amazon.cardSelector)).every((el) => el.style.order === '')).toBe(true);
  });

  it('does not add a second badge when scanned again', () => {
    const before = document.querySelectorAll('price-scout-badge').length;
    c.scan();
    c.scan();
    expect(document.querySelectorAll('price-scout-badge')).toHaveLength(before);
  });

  it('badges and sorts cards that appear later while a sort is active', () => {
    click('asc');
    const last = document.querySelectorAll(amazon.cardSelector).length;
    const clone = document.querySelector(amazon.cardSelector)!.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('price-scout-badge').forEach((b) => b.remove());
    clone.style.order = '';
    document.querySelector(amazon.cardSelector)!.parentElement!.append(clone);
    c.scan();
    expect(document.querySelectorAll('price-scout-badge')).toHaveLength(last + 1);
    expect(clone.style.order).not.toBe('');
  });

  it('re-attaches a badge that the site removed', () => {
    const first = document.querySelector(amazon.cardSelector)!;
    first.querySelector('price-scout-badge')!.remove();
    c.scan();
    expect(first.querySelector('price-scout-badge')).not.toBeNull();
  });

  it('removes everything on destroy', () => {
    click('asc');
    c.destroy();
    expect(document.querySelectorAll('price-scout-badge')).toHaveLength(0);
    expect(toolbar()).toBeNull();
    expect(Array.from(document.querySelectorAll<HTMLElement>(amazon.cardSelector)).every((el) => el.style.order === '')).toBe(true);
  });
});

describe('ListingController recovery (late rendering, vanished toolbar, forced refresh)', () => {
  let c: ListingController;
  let priceHtml = '';
  const firstCard = () => document.querySelector(amazon.cardSelector)!;
  const firstBadge = () => firstCard().querySelector('price-scout-badge')!.shadowRoot!.textContent!;
  beforeEach(() => {
    mountFixture('amazon/sunscreen');
    // Simulate a card whose price has not rendered yet when the extension first sees it.
    const recipe = firstCard().querySelector('[data-cy="price-recipe"]')!;
    priceHtml = recipe.innerHTML;
    recipe.innerHTML = '';
    c = new ListingController(amazon);
    c.start();
  });
  afterEach(() => c.destroy());

  it('starts as "? size" for the half-rendered card', () => {
    expect(firstBadge()).toContain('? size');
  });

  it('picks the card up on a later scan once its price has rendered', () => {
    firstCard().querySelector('[data-cy="price-recipe"]')!.innerHTML = priceHtml;
    c.scan();
    expect(firstBadge()).toContain('₹747 / 100 g');
    expect(c.status().ranked).toBe(48);
  });

  it('gives up on a card that stays unknown, but refresh() always tries again', () => {
    for (let i = 0; i < 10; i++) c.scan();
    firstCard().querySelector('[data-cy="price-recipe"]')!.innerHTML = priceHtml;
    c.scan(); // attempts exhausted: automatic scans no longer re-read this card
    expect(firstBadge()).toContain('? size');
    c.refresh(); // the user asked: always re-read
    expect(firstBadge()).toContain('₹747 / 100 g');
  });

  it('re-sorts after a card resolves while a sort is active', () => {
    (toolbar()!.shadowRoot!.querySelector('[data-dir="asc"]') as HTMLButtonElement).click();
    firstCard().querySelector('[data-cy="price-recipe"]')!.innerHTML = priceHtml;
    c.scan();
    const cards = Array.from(document.querySelectorAll<HTMLElement>(amazon.cardSelector));
    const shown = cards.sort((a, b) => Number(a.style.order) - Number(b.style.order));
    const ranked = shown.map((el) => analyzeCard(amazon.extract(el))).filter((a) => a.state === 'ranked');
    expect(ranked.map((a) => a.per100!)).toEqual(ranked.map((a) => a.per100!).sort((x, y) => x - y));
    expect(ranked).toHaveLength(48);
  });

  it('puts the toolbar back, with its state, if the site removes it', () => {
    (toolbar()!.shadowRoot!.querySelector('[data-dir="desc"]') as HTMLButtonElement).click();
    toolbar()!.remove();
    expect(toolbar()).toBeNull();
    c.scan();
    expect(toolbar()).not.toBeNull();
    expect(toolbar()!.shadowRoot!.querySelector('[data-dir="desc"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(toolbar()!.shadowRoot!.querySelector('.stats')!.textContent).toMatch(/\d+ ranked/);
  });

  it('refresh() makes the toolbar flash', () => {
    c.refresh();
    expect(toolbar()!.shadowRoot!.querySelector('.bar')!.classList.contains('flash')).toBe(true);
  });

  it('reports counts', () => {
    expect(c.status()).toEqual({ cards: 48, ranked: 47, unknown: 1, unavailable: 0 });
  });
});

describe('ListingController on the Flipkart fixture', () => {
  let c: ListingController;
  beforeEach(() => {
    mountFixture('flipkart/shampoo');
    c = new ListingController(flipkart);
    c.start();
  });
  afterEach(() => c.destroy());

  const perHundreds = () =>
    Array.from(document.querySelectorAll(flipkart.cardSelector))
      .map((el) => analyzeCard(flipkart.extract(el)))
      .filter((a) => a.state === 'ranked')
      .map((a) => a.per100!);

  it('reorders cards across rows, ascending', () => {
    const before = Array.from(document.querySelectorAll(flipkart.cardSelector));
    click('asc');
    const after = Array.from(document.querySelectorAll(flipkart.cardSelector));
    expect(after).toHaveLength(before.length);
    expect(new Set(after)).toEqual(new Set(before));
    const v = perHundreds();
    expect(v.length).toBeGreaterThan(30);
    expect([...v].sort((a, b) => a - b)).toEqual(v);
  });

  it('restores the original order on reset', () => {
    const before = Array.from(document.querySelectorAll(flipkart.cardSelector));
    click('asc');
    click('reset');
    expect(Array.from(document.querySelectorAll(flipkart.cardSelector))).toEqual(before);
  });

  it('keeps the row structure: every row still holds only cards', () => {
    click('desc');
    for (const card of document.querySelectorAll(flipkart.cardSelector)) {
      expect(Array.from(card.parentElement!.children).every((k) => k.matches(flipkart.cardSelector))).toBe(true);
    }
  });
});
