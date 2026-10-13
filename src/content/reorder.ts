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

const ROW_TOLERANCE_PX = 8;

const byDocument = (a: Element, b: Element) =>
  a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;

/**
 * The nodes in the order they are drawn: row by row, left to right. On some sites (Flipkart Minutes) the
 * document order differs from the drawn order, e.g. the first row's leftmost card is last in the document.
 * Without layout (hidden nodes, tests) it falls back to document order.
 */
function visualOrder(nodes: Element[]): Element[] {
  const rects = new Map(nodes.map((n) => [n, n.getBoundingClientRect()] as const));
  const laidOut = nodes.every((n) => rects.get(n)!.width > 0 || rects.get(n)!.height > 0);
  if (!laidOut) return [...nodes].sort(byDocument);
  return [...nodes].sort((a, b) => {
    const ra = rects.get(a)!;
    const rb = rects.get(b)!;
    if (Math.abs(ra.top - rb.top) > ROW_TOLERANCE_PX) return ra.top - rb.top;
    return ra.left - rb.left || byDocument(a, b);
  });
}

function domSlots(): Reorderer {
  /** Where each node was drawn before we first moved anything; Reset puts them back there. */
  const original = new Map<Element, number>();

  const apply: Reorderer['apply'] = (nodes, order) => {
    const seen = visualOrder(nodes);
    for (const node of seen) if (!original.has(node)) original.set(node, original.size);

    // One placeholder in front of each node; slot p is the p-th position on screen.
    const slotOf = new Map(seen.map((node) => [node, document.createComment('')] as const));
    for (const [node, marker] of slotOf) node.before(marker);
    const slots = seen.map((node) => slotOf.get(node)!);

    order.forEach((nodeIndex, position) => slots[position].after(nodes[nodeIndex]));
    slots.forEach((marker) => marker.remove());
  };

  return {
    apply,
    reset(nodes) {
      if (original.size === 0) return;
      const rank = (n: Element) => original.get(n) ?? Number.MAX_SAFE_INTEGER;
      const order = nodes.map((_, i) => i).sort((a, b) => rank(nodes[a]) - rank(nodes[b]) || a - b);
      apply(nodes, order);
    },
  };
}

export function createReorderer(strategy: ReorderStrategy): Reorderer {
  return strategy === 'css-order' ? cssOrder() : domSlots();
}
