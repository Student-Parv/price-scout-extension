import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountFixture } from '../helpers';

describe('boot loop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    document.documentElement.removeAttribute('data-price-scout');
    document.body.innerHTML = '';
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
});
