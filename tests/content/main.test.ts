import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountFixture } from '../helpers';

describe('boot loop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    document.body.innerHTML = '';
    // toolbars are attached to <html>, so clearing <body> does not remove ones left by earlier tests
    document.querySelectorAll('price-scout-toolbar').forEach((e) => e.remove());
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing off supported sites', async () => {
    mountFixture('amazon/sunscreen');
    await import('../../src/content/main');
    vi.advanceTimersByTime(1000);
    expect(document.querySelectorAll('price-scout-badge')).toHaveLength(0);
  });

  it('boots once on a supported listing and re-scans when the page changes', async () => {
    const { tick } = await import('../../src/content/main');
    mountFixture('amazon/sunscreen');
    tick(new URL('https://www.amazon.in/s?k=sunscreen'));
    const n = document.querySelectorAll('price-scout-badge').length;
    expect(n).toBeGreaterThan(30);
    tick(new URL('https://www.amazon.in/s?k=sunscreen'));
    expect(document.querySelectorAll('price-scout-badge')).toHaveLength(n);
    expect(document.querySelectorAll('price-scout-toolbar')).toHaveLength(1);
  });

  it('tears down when navigating to a non-listing page and rebuilds on a new search', async () => {
    const { tick } = await import('../../src/content/main');
    mountFixture('amazon/sunscreen');
    tick(new URL('https://www.amazon.in/s?k=sunscreen'));
    tick(new URL('https://www.amazon.in/dp/B0CW5BK193'));
    expect(document.querySelectorAll('price-scout-badge')).toHaveLength(0);
    expect(document.querySelectorAll('price-scout-toolbar')).toHaveLength(0);
    tick(new URL('https://www.amazon.in/s?k=shampoo'));
    expect(document.querySelectorAll('price-scout-toolbar')).toHaveLength(1);
  });

  it('does not show on a non-search page by itself, but retry() forces it when cards are there', async () => {
    const { tick, retry } = await import('../../src/content/main');
    mountFixture('amazon/sunscreen');
    const bestsellers = new URL('https://www.amazon.in/gp/bestsellers/beauty');
    tick(bestsellers);
    expect(document.querySelectorAll('price-scout-badge')).toHaveLength(0);
    const status = retry(bestsellers);
    expect(status.cards).toBe(48);
    expect(status.ranked).toBeGreaterThan(40);
    expect(document.querySelectorAll('price-scout-toolbar')).toHaveLength(1);
    // and it keeps scanning that page afterwards
    tick(bestsellers);
    expect(document.querySelectorAll('price-scout-toolbar')).toHaveLength(1);
  });

  it('retry() on a page with no cards reports zero and shows nothing', async () => {
    const { retry } = await import('../../src/content/main');
    document.body.innerHTML = '<p>no products here</p>';
    expect(retry(new URL('https://www.amazon.in/gp/help'))).toEqual({ cards: 0, ranked: 0, unknown: 0, unavailable: 0 });
    expect(document.querySelectorAll('price-scout-toolbar')).toHaveLength(0);
  });

  it('retry() on an unsupported site reports zero cards', async () => {
    const { retry } = await import('../../src/content/main');
    mountFixture('amazon/sunscreen');
    expect(retry(new URL('https://example.com/s?k=x')).cards).toBe(0);
    expect(document.querySelectorAll('price-scout-badge')).toHaveLength(0);
  });
});
