import type { SiteAdapter } from '../adapters/types';
import { analyzeCard } from '../core/analyze';
import { formatPer100 } from '../core/format';
import { dominantDim, sortOrder, type SortDir } from '../core/rank';
import type { CardAnalysis, RawCard } from '../core/types';
import type { RetryStatus } from '../shared';
import { attachBadge, createBadge, updateBadge, type BadgeView } from './badge';
import { createReorderer, type Reorderer } from './reorder';
import { mountToolbar, type Toolbar } from './toolbar';

/** How many times automatic scans re-read a card that is not ranked yet (it may still be rendering). */
const MAX_AUTO_ATTEMPTS = 6;

interface Entry {
  card: HTMLElement;
  node: Element;
  raw: RawCard;
  analysis: CardAnalysis;
  badge: HTMLElement;
  attempts: number;
}

export class ListingController {
  private entries: Entry[] = [];
  private seen = new WeakSet<Element>();
  private dir: SortDir | null = null;
  private toolbar: Toolbar | null = null;
  private readonly reorderer: Reorderer;

  constructor(private readonly adapter: SiteAdapter) {
    this.reorderer = createReorderer(adapter.reorder);
  }

  start(): void {
    this.toolbar = this.mountToolbar();
    this.update(false);
  }

  /** Automatic pass: pick up new cards, re-read cards that were still rendering, repair the UI. */
  scan(): void {
    this.update(false);
  }

  /** The user clicked the extension icon: re-read everything that is not ranked, repair the UI, pulse the toolbar. */
  refresh(): void {
    this.update(true);
    this.toolbar?.flash();
  }

  status(): RetryStatus {
    return { cards: this.entries.length, ...this.stats() };
  }

  setSort(dir: SortDir | null): void {
    this.dir = dir;
    this.toolbar?.setActive(dir);
    if (dir) this.applySort();
    else this.reorderer.reset(this.entries.map((e) => e.node));
  }

  destroy(): void {
    this.reorderer.reset(this.entries.map((e) => e.node));
    for (const e of this.entries) e.badge.remove();
    this.entries = [];
    this.toolbar?.destroy();
    this.toolbar = null;
    this.dir = null;
  }

  private mountToolbar(): Toolbar {
    const toolbar = mountToolbar((dir) => this.setSort(dir));
    toolbar.setActive(this.dir);
    toolbar.setStats(this.stats());
    return toolbar;
  }

  private update(force: boolean): void {
    this.entries = this.entries.filter((e) => e.card.isConnected);
    if (this.toolbar && !this.toolbar.isConnected()) this.toolbar = this.mountToolbar();

    let changed = this.reanalyse(force);
    for (const el of Array.from(document.querySelectorAll(this.adapter.cardSelector))) {
      if (this.seen.has(el)) continue;
      this.seen.add(el);
      const card = el as HTMLElement;
      const raw = this.adapter.extract(card);
      const badge = createBadge({ text: '', sub: null, tooltip: '', muted: true });
      attachBadge(card, badge);
      this.entries.push({ card, node: this.adapter.sortNode(card), raw, analysis: analyzeCard(raw), badge, attempts: 1 });
      changed = true;
    }
    for (const e of this.entries) if (!e.badge.isConnected) attachBadge(e.card, e.badge);

    if (changed) {
      this.refreshBadges();
      this.toolbar?.setStats(this.stats());
      if (this.dir) this.applySort();
    }
  }

  /** Re-reads cards that are not ranked; returns true when any of them changed. */
  private reanalyse(force: boolean): boolean {
    let changed = false;
    for (const e of this.entries) {
      if (e.analysis.state === 'ranked') continue;
      if (!force && e.attempts >= MAX_AUTO_ATTEMPTS) continue;
      e.attempts++;
      const raw = this.adapter.extract(e.card);
      const analysis = analyzeCard(raw);
      if (analysis.state !== e.analysis.state || analysis.per100 !== e.analysis.per100) {
        e.raw = raw;
        e.analysis = analysis;
        changed = true;
      }
    }
    return changed;
  }

  private applySort(): void {
    const order = sortOrder(
      this.entries.map((e) => ({ per100: e.analysis.per100, state: e.analysis.state })),
      this.dir!,
    );
    this.reorderer.apply(this.entries.map((e) => e.node), order);
  }

  private stats() {
    const count = (s: CardAnalysis['state']) => this.entries.filter((e) => e.analysis.state === s).length;
    return { ranked: count('ranked'), unknown: count('unknown'), unavailable: count('unavailable') };
  }

  private refreshBadges(): void {
    const dominant = dominantDim(
      this.entries.flatMap((e) => (e.analysis.state === 'ranked' ? [e.analysis.quantity!.dim] : [])),
    );
    for (const e of this.entries) updateBadge(e.badge, this.view(e, dominant));
  }

  private view(e: Entry, dominant: ReturnType<typeof dominantDim>): BadgeView {
    const a = e.analysis;
    const ad = e.raw.sponsored ? 'Sponsored. ' : '';
    if (a.state === 'ranked') {
      const q = a.quantity!;
      return {
        text: formatPer100(a.per100!, q.dim, q.dim !== dominant),
        sub: e.raw.deliveryNote,
        tooltip: `${ad}${q.explanation}${a.note ? `\n${a.note}` : ''}`,
        muted: false,
      };
    }
    if (a.state === 'unavailable') return { text: 'Unavailable', sub: null, tooltip: `${ad}Not in stock`, muted: true };
    return { text: '? size', sub: e.raw.deliveryNote, tooltip: `${ad}Could not read a weight or volume`, muted: true };
  }
}
