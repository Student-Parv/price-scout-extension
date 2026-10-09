import { beforeEach, describe, expect, it } from 'vitest';
import { createReorderer } from '../../src/content/reorder';

const texts = (root: Element) => Array.from(root.querySelectorAll('i')).map((e) => e.textContent);

describe('css-order reorderer', () => {
  let grid: HTMLElement;
  let nodes: HTMLElement[];
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="g"><i>A</i><b id="w">widget</b><i>B</i><i>C</i></div>';
    grid = document.getElementById('g')!;
    nodes = Array.from(grid.querySelectorAll('i'));
  });

  it('assigns order values by sorted position and keeps the widget between sorted cards', () => {
    createReorderer('css-order').apply(nodes, [2, 0, 1]); // C, A, B
    expect(nodes[2].style.order).toBe('2'); // C first
    expect(nodes[0].style.order).toBe('4'); // A second
    expect(nodes[1].style.order).toBe('6'); // B third
    // widget sat after 1 card, so it gets 2*1+1 = 3: after the first sorted card, before the second
    expect(document.getElementById('w')!.style.order).toBe('3');
  });

  it('does not move DOM nodes', () => {
    createReorderer('css-order').apply(nodes, [2, 1, 0]);
    expect(texts(grid)).toEqual(['A', 'B', 'C']);
  });

  it('reset clears every order it set', () => {
    const r = createReorderer('css-order');
    r.apply(nodes, [2, 0, 1]);
    r.reset(nodes);
    expect(nodes.every((n) => n.style.order === '')).toBe(true);
    expect(document.getElementById('w')!.style.order).toBe('');
  });
});

describe('dom-slots reorderer', () => {
  let nodes: HTMLElement[];
  const rows = () => Array.from(document.querySelectorAll('.row'));
  beforeEach(() => {
    document.body.innerHTML =
      '<div class="row"><i>A</i><i>B</i></div><p id="banner">ad</p><div class="row"><i>C</i><i>D</i></div>';
    nodes = Array.from(document.querySelectorAll('i'));
  });

  it('fills the existing slots across separate rows', () => {
    createReorderer('dom-slots').apply(nodes, [3, 2, 1, 0]); // D C B A
    expect(texts(rows()[0])).toEqual(['D', 'C']);
    expect(texts(rows()[1])).toEqual(['B', 'A']);
  });

  it('leaves other elements where they were', () => {
    createReorderer('dom-slots').apply(nodes, [3, 2, 1, 0]);
    expect(document.body.children[1].id).toBe('banner');
    expect(document.body.children).toHaveLength(3);
  });

  it('leaves no placeholder comments behind', () => {
    createReorderer('dom-slots').apply(nodes, [1, 0, 3, 2]);
    const comments = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
    expect(comments.nextNode()).toBeNull();
  });

  it('reset restores the first-seen order even after several sorts', () => {
    const r = createReorderer('dom-slots');
    r.apply(nodes, [3, 2, 1, 0]);
    r.apply(nodes, [2, 0, 3, 1]);
    r.reset(nodes);
    expect(texts(rows()[0])).toEqual(['A', 'B']);
    expect(texts(rows()[1])).toEqual(['C', 'D']);
  });
});
