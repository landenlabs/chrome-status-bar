// Copyright LanDen Labs - Dennis Lang 2026
// Source: https://github.com/landenlabs/chrome-status-bar
// Author: https://landenlabs.com
// Licensed under the Apache License, Version 2.0 (see LICENSE).
// List page: shows every link (or image) collected from a page, one row each.
const titleEl = document.getElementById('title');
const sourceEl = document.getElementById('source');
const statusEl = document.getElementById('status');
const filterEl = document.getElementById('filter');
const listEl = document.getElementById('list');

const id = new URLSearchParams(location.search).get('id');
const rows = []; // { row, haystack }

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

function render(data) {
  const isImages = data.kind === 'images';
  const noun = isImages ? 'Images' : 'Links';
  titleEl.textContent = `${noun} (${data.items.length})`;
  document.title = `${noun} — ${data.pageTitle || data.pageUrl}`;

  sourceEl.textContent = 'From: ';
  const src = el('a', '', data.pageTitle || data.pageUrl);
  src.href = data.pageUrl;
  src.title = data.pageUrl;
  sourceEl.appendChild(src);

  const frag = document.createDocumentFragment();
  data.items.forEach((item, i) => {
    const row = el('div', 'row');
    row.appendChild(el('span', 'num', i + 1));

    const text = item.text || (isImages ? '(no alt text)' : '(no text)');
    const textEl = el('span', item.text ? 'text' : 'text none', text);
    textEl.title = text;
    row.appendChild(textEl);

    if (item.info) row.appendChild(el('span', 'info', item.info));

    const url = el('a', 'url', item.url);
    url.href = item.url;
    url.title = item.url;
    url.target = '_blank';
    url.rel = 'noopener noreferrer';
    row.appendChild(url);

    frag.appendChild(row);
    rows.push({ row, haystack: `${item.text || ''} ${item.info || ''} ${item.url}`.toLowerCase() });
  });
  listEl.appendChild(frag);
  updateStatus();
}

function updateStatus() {
  const shown = rows.filter((r) => !r.row.classList.contains('hidden')).length;
  statusEl.textContent = shown === rows.length ? '' : `${shown} of ${rows.length} shown`;
}

filterEl.addEventListener('input', () => {
  const q = filterEl.value.trim().toLowerCase();
  for (const r of rows) r.row.classList.toggle('hidden', !!q && !r.haystack.includes(q));
  updateStatus();
});

// The data stays in session storage so reloading this tab still works;
// background.js removes it when the tab is closed.
chrome.storage.session.get(id, (s) => {
  const data = s && s[id];
  if (!data) {
    titleEl.textContent = 'List not available';
    statusEl.textContent = 'This list has expired. Click Links or Images in the status bar again.';
    filterEl.hidden = true;
    return;
  }
  render(data);
});
