import { describe, expect, it, vi } from 'vitest';
import { injectIntoOpenTabs, retryTab, type TabApi } from '../../src/background/retry';
import { RETRY_MESSAGE, type RetryStatus } from '../../src/shared';

const status = (o: Partial<RetryStatus> = {}): RetryStatus => ({ cards: 48, ranked: 45, unknown: 2, unavailable: 1, ...o });

function fakeApi(over: Partial<TabApi> = {}): TabApi & { badges: [number, string, string][] } {
  const badges: [number, string, string][] = [];
  return {
    send: vi.fn(async () => status()),
    inject: vi.fn(async () => undefined),
    badge: (tabId, text, color) => void badges.push([tabId, text, color]),
    queryTabs: vi.fn(async () => []),
    badges,
    ...over,
  };
}
const noWait = async () => undefined;

describe('retryTab', () => {
  it('asks the page and shows the ranked count when the content script is already there', async () => {
    const api = fakeApi();
    expect(await retryTab(7, api, noWait)).toBe('shown');
    expect(api.send).toHaveBeenCalledWith(7, { type: RETRY_MESSAGE });
    expect(api.inject).not.toHaveBeenCalled();
    expect(api.badges).toEqual([[7, '45', '#0b5d1e']]);
  });

  it('injects the content script when the page does not answer, then asks again', async () => {
    let injected = false;
    const api = fakeApi({
      send: vi.fn(async () => {
        if (!injected) throw new Error('Receiving end does not exist');
        return status({ ranked: 12 });
      }),
      inject: vi.fn(async () => void (injected = true)),
    });
    expect(await retryTab(3, api, noWait)).toBe('shown');
    expect(api.inject).toHaveBeenCalledWith(3);
    expect(api.badges.at(-1)).toEqual([3, '12', '#0b5d1e']);
  });

  it('waits and re-asks a few times after injecting', async () => {
    let asks = 0;
    const api = fakeApi({
      send: vi.fn(async () => {
        asks++;
        if (asks < 3) throw new Error('not ready');
        return status();
      }),
    });
    expect(await retryTab(1, api, noWait)).toBe('shown');
    expect(asks).toBe(3);
  });

  it('reports unsupported when injection is refused (site not allowed)', async () => {
    const api = fakeApi({
      send: vi.fn(async () => {
        throw new Error('no receiver');
      }),
      inject: vi.fn(async () => {
        throw new Error('Cannot access contents of the page');
      }),
    });
    expect(await retryTab(5, api, noWait)).toBe('unsupported');
    expect(api.badges).toEqual([[5, 'N/A', '#5f6368']]);
  });

  it('reports unsupported when the page never answers even after injecting', async () => {
    const api = fakeApi({
      send: vi.fn(async () => {
        throw new Error('no receiver');
      }),
    });
    expect(await retryTab(5, api, noWait)).toBe('unsupported');
    expect(api.badges.at(-1)).toEqual([5, 'N/A', '#5f6368']);
  });

  it('ignores garbage replies', async () => {
    const api = fakeApi({ send: vi.fn(async () => ({ hello: 'world' })) });
    expect(await retryTab(5, api, noWait)).toBe('unsupported');
  });

  it('says 0 in red when the page has no product cards', async () => {
    const api = fakeApi({ send: vi.fn(async () => status({ cards: 0, ranked: 0, unknown: 0, unavailable: 0 })) });
    expect(await retryTab(9, api, noWait)).toBe('none-found');
    expect(api.badges).toEqual([[9, '0', '#b3261e']]);
  });
});

describe('injectIntoOpenTabs', () => {
  it('injects into every open tab on a supported site and survives a failing tab', async () => {
    const inject = vi.fn(async (id: number) => {
      if (id === 2) throw new Error('discarded tab');
    });
    const api = fakeApi({ queryTabs: vi.fn(async () => [1, 2, 3]), inject });
    await injectIntoOpenTabs(['*://www.amazon.in/*'], api);
    expect(api.queryTabs).toHaveBeenCalledWith(['*://www.amazon.in/*']);
    expect(inject).toHaveBeenCalledTimes(3);
  });
});
