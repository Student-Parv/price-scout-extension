import type { SortDir } from '../core/rank';

export interface Toolbar {
  setStats(s: { ranked: number; unknown: number; unavailable: number }): void;
  setActive(dir: SortDir | null): void;
  destroy(): void;
}

const STYLE = `
:host { all: initial; }
.bar { font: 500 13px system-ui, sans-serif; background: #fff; color: #111; border: 1px solid #c7c7c7;
  border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,.25); padding: 8px 10px; display: flex; gap: 6px;
  align-items: center; flex-wrap: wrap; max-width: 340px; }
.t { font-weight: 700; margin-right: 4px; }
button { font: inherit; border: 1px solid #0b5d1e; background: #fff; color: #0b5d1e; border-radius: 6px;
  padding: 4px 8px; cursor: pointer; }
button[aria-pressed="true"] { background: #0b5d1e; color: #fff; }
button.reset { border-color: #888; color: #444; }
.stats { flex-basis: 100%; font-size: 11px; color: #555; }
`;

export function mountToolbar(onSort: (dir: SortDir | null) => void): Toolbar {
  document.querySelectorAll('price-scout-toolbar').forEach((e) => e.remove());
  const host = document.createElement('price-scout-toolbar');
  // Bottom-right: the top-right corner holds each site's cart and account links.
  host.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:2147483646;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>${STYLE}</style>
    <div class="bar">
      <span class="t">Price Scout</span>
      <button data-dir="asc" aria-pressed="false">Best value first</button>
      <button data-dir="desc" aria-pressed="false">Priciest first</button>
      <button data-dir="reset" class="reset">Reset</button>
      <span class="stats"></span>
    </div>`;
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button'));
  const stats = root.querySelector('.stats')!;

  const setActive = (dir: SortDir | null) => {
    for (const b of buttons) {
      if (b.dataset.dir !== 'reset') b.setAttribute('aria-pressed', String(b.dataset.dir === dir));
    }
  };
  for (const b of buttons) {
    b.addEventListener('click', () => {
      const dir = b.dataset.dir === 'reset' ? null : (b.dataset.dir as SortDir);
      setActive(dir);
      onSort(dir);
    });
  }
  document.documentElement.append(host);

  return {
    setStats: (s) => {
      stats.textContent = `${s.ranked} ranked · ${s.unknown} unknown size · ${s.unavailable} unavailable`;
    },
    setActive,
    destroy: () => host.remove(),
  };
}
