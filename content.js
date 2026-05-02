// Content script: parse search results by site, extract per 100g/ml, sort

(function () {

  function detectSite() {
    const hostname = window.location.hostname;
    if (hostname.includes('amazon.in')) return 'amazon';
    if (hostname.includes('flipkart.com')) return 'flipkart';
    if (hostname.includes('myntra.com')) return 'myntra';
    if (hostname.includes('meesho.com')) return 'meesho';
    if (hostname.includes('nykaa.com')) return 'nykaa';
    if (hostname.includes('bigbasket.com')) return 'bigbasket';
    if (hostname.includes('snapdeal.com')) return 'snapdeal';
    if (hostname.includes('zepto.com')) return 'zepto';
    return null;
  }

  const SITE = detectSite();

  // Site-specific configuration: selectors for product cards, price, quantity
  const SITE_CONFIG = {
    amazon: {
      productCards: '[data-component-type="s-search-result"]',
      container: 'div.s-main-slot, #search',
      priceSelectors: ['._30jeq3', '._25b18c', '.a-price-whole', '.a-price-fraction'],
      sizeSelectors: ['.a-size-base', '.s-size-base', 'span'],
      autoRefresh: true
    },
    flipkart: {
      productCards: 'div[data-id], div._1AtVbE, div._2kHmtP',
      container: 'div._31Kbqb, [data-testid="gridIWF"]',
      priceSelectors: ['.hZ3P6w', '.QiM05r .hZ3P6w', '._30jeq3', '.xtXF7d'],
      sizeSelectors: ['.U_GKRr', '.sHq51c', 'div._22HHAe', 'span'],
      autoRefresh: true
    },
    myntra: {
      productCards: '.productCardImg, .productContainer, [data-testid="productCardImg"]',
      container: '.productGrid, .productList, main',
      priceSelectors: ['.productCardPrice', '.productPrice, .discountPrice', 'span.productCardPrice'],
      sizeSelectors: ['.productCardContent', '.productSize', 'span', 'p'],
      autoRefresh: false
    },
    meesho: {
      productCards: '[class*="ProductCard"], .sc-, .productCard, [data-testid*="product"]',
      container: '[class*="ProductGrid"], main, .productsContainer',
      priceSelectors: ['.productPrice', '.price', '[class*="Price"]', 'span'],
      sizeSelectors: ['.productQuantity', '.quantity', '.productDetails', 'span', 'p'],
      autoRefresh: false
    },
    nykaa: {
      productCards: '.productCard, [class*="ProductCard"], .product-item',
      container: '.productGrid, .productList, .products-container',
      priceSelectors: ['.productPrice, .price', '.productCardPrice', 'span'],
      sizeSelectors: ['.productQuantity, .quantity', '.productSize', '.productInfo', 'span'],
      autoRefresh: false
    },
    bigbasket: {
      productCards: '.productList-item, .product-item, [data-testid*="product"]',
      container: '.products-container, .productList, main',
      priceSelectors: ['.price, .productPrice', '.discountedPrice', 'span'],
      sizeSelectors: ['.quantity, .productQuantity', '.productSize', 'span'],
      autoRefresh: false
    },
    snapdeal: {
      productCards: '.prod-item, .productContainer, [class*="product"]',
      container: '.products-container, .productList, main',
      priceSelectors: ['.product-discountPriceText', '.productPrice', '.price', 'span'],
      sizeSelectors: ['.productQuantity, .quantity', '.productSize', '.productTitle', 'span'],
      autoRefresh: false
    },
    zepto: {
      productCards: '.productCard, [class*="ProductCard"], .product',
      container: '.productGrid, .productsContainer, main',
      priceSelectors: ['.price, .productPrice', '[class*="Price"]', 'span'],
      sizeSelectors: ['.quantity, .weight', '.productQuantity', 'span'],
      autoRefresh: false
    }
  };

  const UNIT_INFO = {
    g: { type: 'mass', internalUnit: 'g', internalFactor: 1, label: 'g' },
    gram: { type: 'mass', internalUnit: 'g', internalFactor: 1, label: 'g' },
    grams: { type: 'mass', internalUnit: 'g', internalFactor: 1, label: 'g' },
    kg: { type: 'mass', internalUnit: 'g', internalFactor: 1000, label: 'kg' },
    kgs: { type: 'mass', internalUnit: 'g', internalFactor: 1000, label: 'kg' },
    ml: { type: 'volume', internalUnit: 'ml', internalFactor: 1, label: 'ml' },
    l: { type: 'volume', internalUnit: 'ml', internalFactor: 1000, label: 'l' },
    litre: { type: 'volume', internalUnit: 'ml', internalFactor: 1000, label: 'l' },
    liter: { type: 'volume', internalUnit: 'ml', internalFactor: 1000, label: 'l' },
    ltr: { type: 'volume', internalUnit: 'ml', internalFactor: 1000, label: 'l' }
  };

  function parsePrice(text) {
    if (!text) return null;
    const cleaned = text.replace(/[₹,\s]/g, '');
    const m = cleaned.match(/\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }

  function parseSize(text) {
    if (!text) return null;
    text = text.replace(/–|—/g, '-');
    const pack = text.match(/(\d+)\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*(g|kg|grams?|ml|l|litre|liter|ltr)\b/i);
    if (pack) {
      const count = parseFloat(pack[1]);
      const qty = parseFloat(pack[2]);
      const unit = pack[3].toLowerCase();
      const info = UNIT_INFO[unit.replace(/s$/, '')] || null;
      return info ? {
        displayQty: count * qty,
        displayUnit: info.label,
        internalQty: count * qty * info.internalFactor,
        internalUnit: info.internalUnit,
        type: info.type,
        originalUnit: unit
      } : null;
    }
    const single = text.match(/(\d+(?:\.\d+)?)\s*(g|kg|grams?|ml|l|litre|liter|ltr)\b/i);
    if (single) {
      const qty = parseFloat(single[1]);
      const unit = single[2].toLowerCase();
      const info = UNIT_INFO[unit.replace(/s$/, '')] || null;
      return info ? {
        displayQty: qty,
        displayUnit: info.label,
        internalQty: qty * info.internalFactor,
        internalUnit: info.internalUnit,
        type: info.type,
        originalUnit: unit
      } : null;
    }
    return null;
  }

  function findPriceInElement(item) {
    if (!SITE || !SITE_CONFIG[SITE]) return null;
    const config = SITE_CONFIG[SITE];
    
    // Try configured selectors first
    for (const sel of config.priceSelectors) {
      const nodes = item.querySelectorAll(sel);
      for (const n of nodes) {
        if (n && n.textContent) {
          const p = parsePrice(n.textContent);
          if (p) return p;
        }
      }
    }
    
    // Fallback: search any child node for ₹ followed by number
    const walker = item.querySelectorAll('span, div, p');
    for (const node of walker) {
      if (!node.textContent) continue;
      if (node.textContent.indexOf('₹') !== -1) {
        const p = parsePrice(node.textContent);
        if (p) return p;
      }
    }
    return null;
  }

  function findSizeInElement(item) {
    if (!SITE || !SITE_CONFIG[SITE]) return null;
    const config = SITE_CONFIG[SITE];
    
    // Try configured selectors first
    for (const sel of config.sizeSelectors) {
      const nodes = item.querySelectorAll(sel);
      for (const node of nodes) {
        if (node && node.textContent) {
          const s = parseSize(node.textContent);
          if (s && s.internalQty > 0) return s;
        }
      }
    }
    
    // Final fallback: try whole item text
    return parseSize(item.textContent || '');
  }

  function extractPricePer100(item) {
    // Look for per-100g/ml display like "₹215/100 g" or "₹50/100 ml"
    const allText = item.textContent || '';
    const match = allText.match(/₹\s*(\d+(?:\.\d+)?)\s*\/\s*100\s*(g|ml)/i);
    if (match) {
      return { value: parseFloat(match[1]), unit: match[2].toLowerCase() };
    }
    return null;
  }

  function getItemsForSite() {
    if (!SITE || !SITE_CONFIG[SITE]) return [];
    const config = SITE_CONFIG[SITE];
    const selectors = config.productCards.split(',').map(s => s.trim());
    for (const sel of selectors) {
      const cards = Array.from(document.querySelectorAll(sel));
      if (cards.length > 0) return cards;
    }
    return [];
  }

  function getContainerForSite() {
    if (!SITE || !SITE_CONFIG[SITE]) return null;
    const config = SITE_CONFIG[SITE];
    const selectors = config.container.split(',').map(s => s.trim());
    for (const sel of selectors) {
      const container = document.querySelector(sel);
      if (container) return container;
    }
    return null;
  }

  function addBadge(item, text) {
    let badge = item.querySelector('.value-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'value-badge';
      item.style.position = 'relative';
      item.appendChild(badge);
    }
    badge.textContent = text;
  }

  function processItems() {
    const items = getItemsForSite();
    const results = [];
    const config = SITE_CONFIG[SITE];
    
    items.forEach(item => {
      const price = findPriceInElement(item);
      const size = findSizeInElement(item);
      
      if (price != null && size && size.internalQty > 0) {
        const per100val = (price / size.internalQty) * 100;
        if (Number.isFinite(per100val) && per100val > 0 && per100val < 1e6) {
          const normalizedUnit = size.type === 'mass' ? '100g' : '100ml';
          const displayLabel = `₹ ${per100val.toFixed(2)} / ${normalizedUnit}`;
          addBadge(item, displayLabel);
          item.dataset.valuePerUnit = per100val.toFixed(6);
          item.dataset.valueUnit = size.internalUnit;
          item.dataset.valueType = size.type;
          results.push({ item, unitValue: per100val });
        } else {
          addBadge(item, '— invalid');
          item.dataset.valuePerUnit = '';
        }
      } else {
        let reason = 'not found';
        if (price == null && (!size || !size.internalQty)) reason = 'no price & size';
        else if (price == null) reason = 'no price';
        else if (!size || !size.internalQty) reason = 'no size';
        addBadge(item, `— ${reason}`);
        item.dataset.valuePerUnit = '';
      }
    });
    return results;
  }

  function sortResults() {
    const items = getItemsForSite();
    if (!items.length) return;

    const container = getContainerForSite();
    const parentGroups = new Map();

    items.forEach((item) => {
      const sortableNode = SITE === 'flipkart' ? (item.closest('div._1AtVbE') || item) : item;
      const parent = sortableNode.parentElement;
      if (!parent) return;
      if (container && parent !== container && !container.contains(parent)) return;

      if (!parentGroups.has(parent)) parentGroups.set(parent, new Map());
      const group = parentGroups.get(parent);

      const current = group.get(sortableNode);
      const rawValue = item.dataset.valuePerUnit;
      const value = rawValue ? parseFloat(rawValue) : NaN;
      const type = item.dataset.valueType || '';

      if (!current) {
        group.set(sortableNode, { node: sortableNode, value, hasValue: Number.isFinite(value), type });
      } else if (!current.hasValue && Number.isFinite(value)) {
        group.set(sortableNode, { node: sortableNode, value, hasValue: true, type });
      }
    });

    parentGroups.forEach((groupMap, parent) => {
      const entries = Array.from(groupMap.values());
      if (entries.length < 2) return;

      const parsed = entries.filter(e => e.hasValue);
      const unparsed = entries.filter(e => !e.hasValue);

      // Keep mass and volume independent, then sort each bucket by value.
      const mass = parsed.filter(e => e.type === 'mass').sort((a, b) => a.value - b.value);
      const volume = parsed.filter(e => e.type === 'volume').sort((a, b) => a.value - b.value);
      const unknown = parsed.filter(e => e.type !== 'mass' && e.type !== 'volume').sort((a, b) => a.value - b.value);

      mass.concat(volume, unknown, unparsed).forEach((entry) => parent.appendChild(entry.node));
    });
  }

  function throttle(fn, delay) {
    let last = 0;
    let timeoutId = null;
    return function throttled() {
      const now = Date.now();
      const remaining = delay - (now - last);
      if (remaining <= 0) {
        last = now;
        fn();
      } else if (!timeoutId) {
        timeoutId = setTimeout(() => {
          timeoutId = null;
          last = Date.now();
          fn();
        }, remaining);
      }
    };
  }

  function setupAutoRefresh() {
    // Set up auto-refresh for sites that need it (lazy-load detection)
    if (!SITE || !SITE_CONFIG[SITE] || !SITE_CONFIG[SITE].autoRefresh) return;
    
    const delayedRuns = [0, 700, 1600, 3000];
    delayedRuns.forEach((delay) => {
      setTimeout(() => {
        processItems();
      }, delay);
    });

    const onScrollRefresh = throttle(() => {
      processItems();
    }, 600);
    window.addEventListener('scroll', onScrollRefresh, { passive: true });
  }

  // register message listener early so popup messages are not missed
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg && msg.action === 'sort_by_value') {
        processItems();
        sortResults();
        sendResponse && sendResponse({ ok: true });
      }
    });
  }

  function insertControl() {
    if (document.getElementById('value-sort-control')) return;
    // Only inject an on-page control for Amazon (Flipkart will use popup trigger)
    if (SITE !== 'amazon') return;
    const btn = document.createElement('button');
    btn.id = 'value-sort-control';
    btn.textContent = 'Sort by value / unit';
    btn.className = 'value-sort-btn';
    btn.addEventListener('click', () => {
      processItems();
      sortResults();
    });
    document.body.appendChild(btn);
  }

  function init() {
    if (!SITE) return;
    // For Amazon inject page control; for other sites rely on popup message to trigger sorting
    if (SITE === 'amazon') insertControl();
    processItems();
    setupAutoRefresh();
  }

  // run once when the page is ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 300);
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(init, 300), { once: true });
  }

})();
