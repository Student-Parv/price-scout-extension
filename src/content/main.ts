import { pickAdapter } from '../adapters';
import { RETRY_MESSAGE, type RetryStatus } from '../shared';
import { ListingController } from './controller';

const TAKEOVER = 'price-scout:takeover';
const EMPTY: RetryStatus = { cards: 0, ranked: 0, unknown: 0, unavailable: 0 };

let controller: ListingController | null = null;
let activeHref = '';

/**
 * One pass: (re)build or refresh the controller for the given URL. Exported for tests.
 * `force` shows the UI on any page of a supported site that has product cards, not only on search pages.
 */
export function tick(url: URL = new URL(location.href), force = false): void {
  if (url.href !== activeHref) {
    controller?.destroy();
    controller = null;
    activeHref = url.href;
  }
  if (controller) {
    controller.scan();
    return;
  }
  const adapter = pickAdapter(url);
  if (!adapter) return;
  if (!adapter.isListingPage(url) && !(force && document.querySelector(adapter.cardSelector))) return;
  controller = new ListingController(adapter);
  controller.start();
}

/** The user clicked the extension icon: try again, forced, and report what is on the page. */
export function retry(url: URL = new URL(location.href)): RetryStatus {
  tick(url, true);
  controller?.refresh();
  return controller?.status() ?? { ...EMPTY };
}

function listen(): () => void {
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return () => {};
  const handler = (message: unknown, _sender: unknown, respond: (status: RetryStatus) => void) => {
    if ((message as { type?: unknown } | null)?.type === RETRY_MESSAGE) respond(retry());
  };
  chrome.runtime.onMessage.addListener(handler);
  return () => {
    try {
      chrome.runtime.onMessage.removeListener(handler);
    } catch {
      /* the old extension context is already gone */
    }
  };
}

function boot(): void {
  // A copy of this script from before an extension reload or a re-injection retires itself.
  document.dispatchEvent(new CustomEvent(TAKEOVER));

  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      tick();
    }, 300);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('popstate', schedule);
  window.addEventListener('pageshow', schedule);
  const stopListening = listen();

  const retire = () => {
    observer.disconnect();
    if (timer) clearTimeout(timer);
    window.removeEventListener('popstate', schedule);
    window.removeEventListener('pageshow', schedule);
    document.removeEventListener(TAKEOVER, retire);
    stopListening();
    controller?.destroy();
    controller = null;
  };
  document.addEventListener(TAKEOVER, retire);
  tick();
}

if (typeof document !== 'undefined' && pickAdapter(new URL(location.href))) boot();
