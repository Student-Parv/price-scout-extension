export type ReorderStrategy = 'css-order' | 'dom-slots';

export interface Reorderer {
  /** `nodes` are in first-seen order; `order[p]` is the index in `nodes` shown at position `p`. */
  apply(nodes: Element[], order: number[]): void;
  reset(nodes: Element[]): void;
}

function cssOrder(): Reorderer {
  const touched = new Set<HTMLElement>();
  return {
    apply(nodes, order) {
      const parent = nodes[0]?.parentElement;
      if (!parent) return;
      const isCard = new Set<Element>(nodes);
      // Non-card children (widgets) keep their place: odd values sit between sorted cards.
      let cardsSeen = 0;
      for (const child of Array.from(parent.children) as HTMLElement[]) {
        if (isCard.has(child)) {
          cardsSeen++;
          continue;
        }
        child.style.order = String(2 * cardsSeen + 1);
        touched.add(child);
      }
      order.forEach((nodeIndex, position) => {
        const node = nodes[nodeIndex] as HTMLElement;
        node.style.order = String(2 * position + 2);
        touched.add(node);
      });
    },
    reset() {
      for (const el of touched) el.style.removeProperty('order');
      touched.clear();
    },
  };
}

function domSlots(): Reorderer {
  const apply: Reorderer['apply'] = (nodes, order) => {
    const inDom = [...nodes].sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
    const slots = inDom.map((node) => {
      const marker = document.createComment('');
      node.before(marker);
      return marker;
    });
    order.forEach((nodeIndex, position) => slots[position].after(nodes[nodeIndex]));
    slots.forEach((marker) => marker.remove());
  };
  return {
    apply,
    reset: (nodes) => apply(nodes, nodes.map((_, i) => i)),
  };
}

export function createReorderer(strategy: ReorderStrategy): Reorderer {
  return strategy === 'css-order' ? cssOrder() : domSlots();
}
