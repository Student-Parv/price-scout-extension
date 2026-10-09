import { injectIntoOpenTabs, retryTab, type TabApi } from './retry';

const BADGE_VISIBLE_MS = 4000;

const quiet = (p: Promise<unknown>) => p.catch(() => undefined); // the tab may have closed meanwhile

const api: TabApi = {
  send: (tabId, message) => chrome.tabs.sendMessage(tabId, message),
  inject: async (tabId) => {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  },
  badge: (tabId, text, color) => {
    void quiet(chrome.action.setBadgeBackgroundColor({ tabId, color }));
    void quiet(chrome.action.setBadgeText({ tabId, text }));
    setTimeout(() => void quiet(chrome.action.setBadgeText({ tabId, text: '' })), BADGE_VISIBLE_MS);
  },
  queryTabs: async (urlPatterns) => {
    const tabs = await chrome.tabs.query({ url: urlPatterns });
    return tabs.flatMap((t) => (t.id === undefined ? [] : [t.id]));
  },
};

// Clicking the extension icon: try again on this tab.
chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) void retryTab(tab.id, api);
});

// Installing or updating the extension: bring tabs that are already open to life.
chrome.runtime.onInstalled.addListener(() => {
  void injectIntoOpenTabs(chrome.runtime.getManifest().host_permissions ?? [], api);
});

// Lets the live check in scripts/ trigger the same code path as an icon click (a real click cannot be automated).
(globalThis as Record<string, unknown>).priceScoutRetry = (tabId: number) => retryTab(tabId, api);
