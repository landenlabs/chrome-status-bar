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

// Drop a list's data when its tab is closed.
chrome.tabs.onRemoved.addListener((tabId) => {
  const key = `tab-${tabId}`;
  chrome.storage.session.get(key, (s) => {
    if (s && s[key]) chrome.storage.session.remove([key, s[key]]);
  });
});
