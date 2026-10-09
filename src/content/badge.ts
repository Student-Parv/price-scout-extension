export interface BadgeView {
  text: string;
  sub: string | null;
  tooltip: string;
  muted: boolean;
}

const STYLE = `
:host { all: initial; }
.b { font: 600 12px/1.25 system-ui, sans-serif; background: #0b5d1e; color: #fff; padding: 4px 8px;
  border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,.35); white-space: nowrap; display: inline-block; }
.b.muted { background: #5f6368; font-weight: 500; }
.s { display: block; font-weight: 400; font-size: 10px; opacity: .9; }
`;

export function createBadge(view: BadgeView): HTMLElement {
  const host = document.createElement('price-scout-badge');
  host.style.cssText = 'position:absolute;top:6px;left:6px;z-index:2147483000;';
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = STYLE;
  const box = document.createElement('span');
  root.append(style, box);
  updateBadge(host, view);
  return host;
}

export function updateBadge(host: HTMLElement, view: BadgeView): void {
  const box = host.shadowRoot!.querySelector('span')!;
  box.className = view.muted ? 'b muted' : 'b';
  box.title = view.tooltip;
  box.replaceChildren(view.text);
  if (view.sub) {
    const sub = document.createElement('span');
    sub.className = 's';
    sub.textContent = view.sub;
    box.append(sub);
  }
}

/** Ensures the card can anchor an absolutely positioned badge, then appends it. */
export function attachBadge(card: HTMLElement, host: HTMLElement): void {
  const position = getComputedStyle(card).position;
  if (!position || position === 'static') card.style.position = 'relative';
  card.append(host);
}
