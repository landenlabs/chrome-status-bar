// Copyright LanDen Labs - Dennis Lang 2026
// Source: https://github.com/landenlabs/chrome-status-bar
// Author: https://landenlabs.com
// Licensed under the Apache License, Version 2.0 (see LICENSE).
// Opens the link/image list page. Content scripts can't open tabs, so the bar
// sends the collected list here; it is parked in session storage (memory only,
// cleared when the browser closes) and the list page picks it up by id.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || !sender.tab) return;
  // Hovered video inside an iframe (frame.js): pass it to the bar in the top frame.
  if (msg.type === 'frame-video' && sender.frameId !== 0) {
    chrome.tabs.sendMessage(sender.tab.id, { type: 'frame-video', info: msg.info || null },
      { frameId: 0 }).catch(() => {});
    return;
  }
  if (msg.type === 'open-image') {
    openWithReferer(msg.url, msg.pageUrl, sender.tab, !!msg.background);
    return;
  }
  if (msg.type !== 'open-list') return;
  const id = `list-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const data = {
    kind: msg.kind === 'images' ? 'images' : 'links',
    items: Array.isArray(msg.items) ? msg.items : [],
    pageUrl: msg.pageUrl || '',
    pageTitle: msg.pageTitle || '',
  };
  chrome.storage.session.set({ [id]: data }, () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL(`list.html?id=${id}`),
      index: sender.tab.index + 1,
      openerTabId: sender.tab.id,
    }, (tab) => {
      if (tab) chrome.storage.session.set({ [`tab-${tab.id}`]: id });
    });
  });
});

// Image hosts often reject requests without their own site as the Referer
// ("hotlink protection"). Open the image in a new tab with a header rule, scoped
// to that tab only, that sends the original page as the Referer. Top-level
// navigation already carries the host's cookies, so the header is all that's missing.
async function openWithReferer(url, pageUrl, fromTab, background) {
  let host;
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) throw new Error('not http');
    host = u.hostname;
    if (!/^https?:/.test(pageUrl)) pageUrl = '';
  } catch {
    host = null;
  }
  const props = { index: fromTab.index + 1, openerTabId: fromTab.id, active: !background };
  if (!host || !pageUrl) {
    chrome.tabs.create({ ...props, url });
    return;
  }
  // Create the tab blank first so the rule is in place before the request goes out.
  const tab = await chrome.tabs.create({ ...props, url: 'about:blank' });
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [tab.id],
    addRules: [{
      id: tab.id,
      priority: 1,
      condition: {
        tabIds: [tab.id],
        requestDomains: [host],
        resourceTypes: ['main_frame', 'image'],
      },
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{ header: 'referer', operation: 'set', value: pageUrl }],
      },
    }],
  });
  chrome.tabs.update(tab.id, { url });
}

// Drop a list's data when its tab is closed, and any Referer rule for the tab.
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId] }).catch(() => {});
  const key = `tab-${tabId}`;
  chrome.storage.session.get(key, (s) => {
    if (s && s[key]) chrome.storage.session.remove([key, s[key]]);
  });
});
