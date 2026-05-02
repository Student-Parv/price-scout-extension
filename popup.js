// Buttons to open search pages on each platform
document.getElementById('amazon-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.amazon.in/s?k=shampoo' });
});

document.getElementById('flipkart-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.flipkart.com/search?q=shampoo' });
});

document.getElementById('myntra-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.myntra.com/search?q=shampoo' });
});

document.getElementById('meesho-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.meesho.com/search?q=shampoo' });
});

document.getElementById('nykaa-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.nykaa.com/search/result?q=shampoo' });
});

document.getElementById('bigbasket-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.bigbasket.com/search/?q=shampoo' });
});

document.getElementById('snapdeal-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.snapdeal.com/search?keyword=shampoo' });
});

document.getElementById('zepto-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.zepto.com/search?query=shampoo' });
});

const statusEl = document.getElementById('status');
function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

// Sort current page button
document.getElementById('sort-current').addEventListener('click', () => {
  setStatus('Sorting...');
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) {
      setStatus('No active tab found.');
      return;
    }
    chrome.tabs.sendMessage(tabs[0].id, { action: 'sort_by_value' }, (resp) => {
      if (chrome.runtime.lastError) {
        setStatus('Open an e-commerce search page and try again.');
        return;
      }
      if (resp && resp.ok) {
        setStatus('✓ Sorted successfully.');
      } else {
        setStatus('Sort request sent.');
      }
    });
  });
});
