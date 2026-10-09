import { pickAdapter } from '../adapters';
import { ListingController } from './controller';

let controller: ListingController | null = null;
let activeHref = '';

/** One pass: (re)build or refresh the controller for the given URL. Exported for tests. */
export function tick(url: URL = new URL(location.href)): void {
  if (url.href !== activeHref) {
    controller?.destroy();
    controller = null;
    activeHref = url.href;
  }
  const adapter = pickAdapter(url);
  if (!adapter || !adapter.isListingPage(url)) return;
  if (!controller) {
    controller = new ListingController(adapter);
    controller.start();
  } else {
    controller.scan();
  }
}

function boot(): void {
  if (document.documentElement.dataset.priceScout) return;
  document.documentElement.dataset.priceScout = '1';
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      tick();
    }, 300);
  };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('popstate', schedule);
  tick();
}

if (typeof document !== 'undefined' && pickAdapter(new URL(location.href))) boot();
