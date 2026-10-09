import { RETRY_MESSAGE, isRetryStatus, type RetryStatus } from '../shared';

const GREEN = '#0b5d1e';
const RED = '#b3261e';
const GREY = '#5f6368';

/** The few browser calls the retry logic needs, so it can be tested without a browser. */
export interface TabApi {
  send(tabId: number, message: unknown): Promise<unknown>;
  /** Runs the content script in the tab. Rejects when the browser refuses (site not allowed, internal page). */
  inject(tabId: number): Promise<void>;
  /** Shows a short-lived text on the extension icon for this tab. */
  badge(tabId: number, text: string, color: string): void;
  queryTabs(urlPatterns: string[]): Promise<number[]>;
}

export type Outcome = 'shown' | 'none-found' | 'unsupported';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function ask(tabId: number, api: TabApi): Promise<RetryStatus | null> {
  try {
    const reply = await api.send(tabId, { type: RETRY_MESSAGE });
    return isRetryStatus(reply) ? reply : null;
  } catch {
    return null; // no content script in that tab
  }
}

/**
 * The user clicked the extension icon on a tab: ask the page to try again; if no content script is
 * there (tab opened before the extension was installed or reloaded), inject it first.
 */
export async function retryTab(tabId: number, api: TabApi, wait: (ms: number) => Promise<void> = sleep): Promise<Outcome> {
  let status = await ask(tabId, api);

  if (!status) {
    try {
      await api.inject(tabId);
    } catch {
      api.badge(tabId, 'N/A', GREY);
      return 'unsupported';
    }
    for (let i = 0; i < 3 && !status; i++) {
      await wait(100);
      status = await ask(tabId, api);
    }
  }

  if (!status) {
    api.badge(tabId, 'N/A', GREY);
    return 'unsupported';
  }
  if (status.cards === 0) {
    api.badge(tabId, '0', RED);
    return 'none-found';
  }
  api.badge(tabId, String(status.ranked), GREEN);
  return 'shown';
}

/** After install or update: bring already-open shopping tabs to life without a page reload. */
export async function injectIntoOpenTabs(urlPatterns: string[], api: TabApi): Promise<void> {
  const tabIds = await api.queryTabs(urlPatterns);
  await Promise.all(tabIds.map((id) => api.inject(id).catch(() => undefined)));
}
