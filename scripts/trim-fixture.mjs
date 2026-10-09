// Usage: node scripts/trim-fixture.mjs <saved-page.html> <tests/fixtures/site/name.html>
// Keeps only <body> markup: no scripts, styles, images, comments or inline styles.
import { JSDOM } from 'jsdom';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const [src, dest] = process.argv.slice(2);
if (!src || !dest) {
  console.error('usage: node scripts/trim-fixture.mjs <src.html> <dest.html>');
  process.exit(1);
}
const dom = new JSDOM(readFileSync(src, 'utf8'));
const { document, NodeFilter } = dom.window;
document
  .querySelectorAll('script,style,link,noscript,svg,img,picture,source,iframe,video,audio,canvas,template')
  .forEach((n) => n.remove());
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
const comments = [];
while (walker.nextNode()) comments.push(walker.currentNode);
comments.forEach((c) => c.remove());
document.body.querySelectorAll('*').forEach((el) => {
  for (const a of Array.from(el.attributes)) {
    if (a.name === 'style' || a.name.startsWith('on')) el.removeAttribute(a.name);
  }
});
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, document.body.innerHTML);
console.log(dest, document.body.innerHTML.length, 'bytes');
