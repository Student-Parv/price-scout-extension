import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

const SNIPPET = readFileSync('scripts/capture-page.js', 'utf8');

describe('scripts/capture-page.js (console snippet)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as unknown as Record<string, unknown>).__priceScoutCapture;
  });

  it('produces trimmed markup with struck prices marked, and downloads it', () => {
    document.body.innerHTML =
      '<div class="card" style="color:red" onclick="x()"><script>evil()</script><style>.a{}</style><img src="a.png">' +
      '<span class="old">₹249</span><span class="new">₹214</span><svg></svg><!-- note --></div>';
    // jsdom has no stylesheet engine: report the old price as struck through, like a browser would
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
      const cs = real(el);
      return new Proxy(cs, { get: (t, k) => (k === 'textDecorationLine' ? (el.classList.contains('old') ? 'line-through' : 'none') : Reflect.get(t, k)) });
    });
    const created = vi.fn(() => 'blob:fake');
    Object.assign(URL, { createObjectURL: created });
    let downloaded = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloaded = this.download;
    });

    new Function(SNIPPET)();

    const html = (window as unknown as { __priceScoutCapture: string }).__priceScoutCapture;
    expect(html).toContain('captured from');
    expect(html).toContain('<span class="old" data-ps-struck="1">₹249</span>');
    expect(html).toContain('<span class="new">₹214</span>');
    expect(html).not.toMatch(/<script|<style|<img|<svg|style=|onclick|note/);
    expect(created).toHaveBeenCalledTimes(1);
    expect(downloaded).toMatch(/^capture-.*\.html$/);
    expect(document.querySelector('a[download]')).toBeNull(); // the temporary link is removed again
  });
});
