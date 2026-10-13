const PRICE_LEAF = /^₹\s?\d[\d,]*(\.\d+)?$/;

/** An element with no child elements whose text is just a rupee amount, e.g. "₹214". */
export function isPriceLeaf(el: Element): boolean {
  return el.children.length === 0 && PRICE_LEAF.test(el.textContent?.trim() ?? '');
}

/**
 * Finds product cards on pages whose class names are generated (atomic CSS, React Native Web).
 * A card is the smallest ancestor of a price that
 *   - is one of at least `minSiblings` children of the same parent that each contain a price, and
 *   - holds some real text besides prices (a title, which can be short: "Wheat Atta").
 * "At least 3" keeps a price row (old price + new price) from being mistaken for a card.
 */
export function findCardsByPrice(root: ParentNode, minSiblings = 3): Element[] {
  const leaves = Array.from(root.querySelectorAll('*')).filter(isPriceLeaf);
  const hasPrice = new Set<Element>();
  for (const leaf of leaves) for (let n: Element | null = leaf; n; n = n.parentElement) hasPrice.add(n);

  const cards = new Set<Element>();
  for (const leaf of leaves) {
    for (let a: Element | null = leaf.parentElement; a?.parentElement; a = a.parentElement) {
      const siblings = Array.from(a.parentElement.children).filter((c) => hasPrice.has(c));
      if (siblings.length >= minSiblings && hasTitleText(a)) {
        cards.add(a);
        break;
      }
    }
  }
  // Never return a card that contains another card: keep the innermost.
  const list = Array.from(cards).filter((c) => !Array.from(cards).some((o) => o !== c && c.contains(o)));
  return list.sort((x, y) => (x.compareDocumentPosition(y) & 4 /* FOLLOWING */ ? -1 : 1));
}

/** Text that is neither a price nor a button or badge label. */
const LABEL = /^(₹.*|\d+%\s*off|add|ad|best\s*seller|off|new|notify me|sold out)$/i;

/** At least one text node with 4+ characters, including letters, that is not a price or a label. */
function hasTitleText(el: Element): boolean {
  const walker = el.ownerDocument.createTreeWalker(el, 4 /* SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent?.trim() ?? '';
    if (t.length >= 4 && /[A-Za-z]{3}/.test(t) && !LABEL.test(t)) return true;
  }
  return false;
}
