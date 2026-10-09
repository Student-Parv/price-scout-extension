// @vitest-environment-options {"url": "https://www.amazon.in/s?k=sunscreen"}
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RETRY_MESSAGE } from '../../src/shared';
import { mountFixture } from '../helpers';

type Listener = (msg: unknown, sender: unknown, respond: (r: unknown) => void) => void;

describe('boot on amazon.in (real page URL)', () => {
  let listeners: Listener[];
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    listeners = [];
    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: {
          addListener: (l: Listener) => listeners.push(l),
          removeListener: (l: Listener) => void (listeners = listeners.filter((x) => x !== l)),
        },
      },
    });
    mountFixture('amazon/sunscreen');
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    document.querySelectorAll('price-scout-toolbar').forEach((e) => e.remove());
  });

  it('shows badges and the toolbar on load without any click', async () => {
    await import('../../src/content/main');
    expect(document.querySelectorAll('price-scout-badge')).toHaveLength(48);
    expect(document.querySelectorAll('price-scout-toolbar')).toHaveLength(1);
  });

  it('answers the retry message with counts and ignores other messages', async () => {
    await import('../../src/content/main');
    expect(listeners).toHaveLength(1);
    const respond = vi.fn();
    listeners[0]({ type: 'something-else' }, {}, respond);
    expect(respond).not.toHaveBeenCalled();
    listeners[0]({ type: RETRY_MESSAGE }, {}, respond);
    expect(respond).toHaveBeenCalledTimes(1);
    expect(respond.mock.calls[0][0]).toMatchObject({ cards: 48 });
    expect(respond.mock.calls[0][0].ranked).toBeGreaterThan(40);
  });

  it('a second copy of the script (re-injected) replaces the first instead of doubling up', async () => {
    await import('../../src/content/main');
    vi.resetModules(); // a fresh module instance = a freshly injected copy
    await import('../../src/content/main');
    expect(document.querySelectorAll('price-scout-badge')).toHaveLength(48);
    expect(document.querySelectorAll('price-scout-toolbar')).toHaveLength(1);
    expect(listeners).toHaveLength(1); // the old copy removed its message listener
  });

  it('re-scans when the page is restored from the back/forward cache', async () => {
    await import('../../src/content/main');
    document.querySelector('price-scout-toolbar')!.remove();
    window.dispatchEvent(new Event('pageshow'));
    vi.advanceTimersByTime(400);
    expect(document.querySelectorAll('price-scout-toolbar')).toHaveLength(1);
  });
});
