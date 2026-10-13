// Saves the current page as a trimmed HTML file so an adapter can be written for it and tested offline.
//
// How to use: open a product-listing page (e.g. a search for "sunscreen") in your own browser with your
// delivery location set, press F12, open the Console tab, paste this whole file and press Enter.
// A file named capture-<site>.html is downloaded. It has no scripts, styles or images.
// It is plain page text and markup: open it once and delete anything personal (your name or address in
// the header) before you share it.
(() => {
  const live = Array.from(document.body.querySelectorAll('*'));
  const clone = document.body.cloneNode(true);
  const copy = Array.from(clone.querySelectorAll('*'));

  // Stylesheets are dropped, so record what only CSS tells us: which text is struck through (old prices).
  live.forEach((el, i) => {
    if (getComputedStyle(el).textDecorationLine.includes('line-through')) copy[i].setAttribute('data-ps-struck', '1');
  });

  clone
    .querySelectorAll('script,style,link,noscript,svg,img,picture,source,iframe,video,audio,canvas,template')
    .forEach((n) => n.remove());
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_COMMENT);
  const comments = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((c) => c.remove());
  clone.querySelectorAll('*').forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      if (a.name === 'style' || a.name.startsWith('on')) el.removeAttribute(a.name);
    }
  });

  const html = `<!-- captured from ${location.href} on ${new Date().toISOString()} -->\n` + clone.innerHTML;
  window.__priceScoutCapture = html; // also kept here so it can be read without the download

  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  link.download = `capture-${location.hostname.replace(/^www\./, '')}.html`;
  document.body.append(link);
  link.click();
  link.remove();
  console.log(`Price Scout capture: ${html.length} characters saved as ${link.download}`);
})();
