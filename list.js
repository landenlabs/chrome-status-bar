// Copyright LanDen Labs - Dennis Lang 2026
// Source: https://github.com/landenlabs/chrome-status-bar
// Author: https://landenlabs.com
// Licensed under the Apache License, Version 2.0 (see LICENSE).
// List page: shows every link (or image) collected from a page, one row each.
// For images the page is split: list on the left, a viewer on the right.
const titleEl = document.getElementById('title');
const sourceEl = document.getElementById('source');
const statusEl = document.getElementById('status');
const filterEl = document.getElementById('filter');
const minSizeEl = document.getElementById('minSize');
const unknownEl = document.getElementById('unknown');
const listEl = document.getElementById('list');
const listPane = document.getElementById('listPane');
const sash = document.getElementById('sash');
const viewerInfo = document.getElementById('viewerInfo');
const openTabBtn = document.getElementById('openTab');
const stage = document.getElementById('stage');

const id = new URLSearchParams(location.search).get('id');
const rows = []; // { row, item, haystack }
let pageUrl = '';
let selected = null; // entry from rows

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

function render(data) {
  const isImages = data.kind === 'images';
  const noun = isImages ? 'Images' : 'Links';
  pageUrl = data.pageUrl;
  titleEl.textContent = `${noun} (${data.items.length})`;
  document.title = `${noun} — ${data.pageTitle || data.pageUrl}`;
  if (isImages) {
    document.body.classList.add('images');
    document.getElementById('hint').hidden = false;
    document.querySelector('.sizeFilter').hidden = false;
    restoreSash();
  }

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

    const entry = { row, item, haystack: `${item.text || ''} ${item.info || ''} ${item.url}`.toLowerCase() };
    if (isImages) {
      // Plain click shows the image in the viewer; Cmd/Ctrl/middle-click opens a tab.
      row.addEventListener('click', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        if (e.metaKey || e.ctrlKey) openImageTab(item.url, true);
        else select(entry);
      });
      url.addEventListener('auxclick', (e) => {
        if (e.button !== 1) return;
        e.preventDefault();
        openImageTab(item.url, true);
      });
    }
    frag.appendChild(row);
    rows.push(entry);
  });
  listEl.appendChild(frag);
  applyFilter();
}

function updateStatus() {
  const shown = visibleRows().length;
  statusEl.textContent = shown === rows.length ? '' : `${shown} of ${rows.length} shown`;
}

const visibleRows = () => rows.filter((r) => !r.row.classList.contains('hidden'));

// Text filter for both lists; for images also the min-size / unknown-size filter.
function applyFilter() {
  const q = filterEl.value.trim().toLowerCase();
  const isImages = document.body.classList.contains('images');
  const minSize = Math.max(0, Number(minSizeEl.value) || 0);
  const includeUnknown = unknownEl.checked;
  for (const r of rows) {
    let show = !q || r.haystack.includes(q);
    if (show && isImages) {
      const { width = 0, height = 0 } = r.item;
      show = width && height ? Math.min(width, height) >= minSize : includeUnknown;
    }
    r.row.classList.toggle('hidden', !show);
  }
  updateStatus();
}
filterEl.addEventListener('input', applyFilter);
minSizeEl.addEventListener('input', applyFilter);
unknownEl.addEventListener('change', applyFilter);

// ---------- Image viewer ----------
// Image requests from this tab get the source page as Referer (rule set up by
// background.js), since many image hosts deny requests without it.
function openImageTab(url, background) {
  if (!/^https?:/.test(url)) return;
  chrome.runtime.sendMessage({ type: 'open-image', url, pageUrl, background });
}

function select(entry) {
  if (selected) selected.row.classList.remove('selected');
  selected = entry;
  entry.row.classList.add('selected');
  entry.row.scrollIntoView({ block: 'nearest' });

  const { item } = entry;
  const label = [item.text, item.url].filter(Boolean).join(' — ');
  viewerInfo.textContent = 'Loading…';
  viewerInfo.title = item.url;
  openTabBtn.disabled = !/^https?:/.test(item.url);
  stage.replaceChildren();
  stage.classList.add('fit');

  const img = new Image();
  img.alt = item.text || '';
  img.addEventListener('load', () => {
    if (selected !== entry) return;
    viewerInfo.textContent = `${img.naturalWidth}×${img.naturalHeight} · ${label}`;
  });
  img.addEventListener('error', () => {
    if (selected !== entry) return;
    viewerInfo.textContent = label;
    const why = item.url.startsWith('data:') && item.url.endsWith('...')
      ? 'Inline (data:) image was too long to keep; open the original page to see it.'
      : 'Image failed to load.';
    stage.replaceChildren(el('div', 'msg', why));
  });
  img.addEventListener('click', () => stage.classList.toggle('fit'));
  img.src = item.url;
  stage.appendChild(img);
}

openTabBtn.addEventListener('click', () => {
  if (selected) openImageTab(selected.item.url, false);
});

// Up/Down step through the visible (filtered) images.
document.addEventListener('keydown', (e) => {
  if (!document.body.classList.contains('images')) return;
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
  if (e.target === minSizeEl) return; // arrows step the number there
  const list = visibleRows();
  if (!list.length) return;
  e.preventDefault();
  let i = list.indexOf(selected);
  if (i < 0) i = e.key === 'ArrowDown' ? 0 : list.length - 1;
  else i = (i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
  select(list[i]);
});

// ---------- Draggable sash ----------
const SASH_KEY = 'listPaneWidth';
function setPaneWidth(px) {
  const max = document.getElementById('split').clientWidth - 126; // keep viewer usable
  listPane.style.width = `${Math.max(120, Math.min(px, max))}px`;
}
function restoreSash() {
  const w = Number(localStorage.getItem(SASH_KEY));
  if (w) setPaneWidth(w);
}
sash.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  sash.setPointerCapture(e.pointerId);
  document.body.classList.add('dragging');
  const startX = e.clientX;
  const startW = listPane.getBoundingClientRect().width;
  const move = (ev) => setPaneWidth(startW + ev.clientX - startX);
  const up = () => {
    sash.removeEventListener('pointermove', move);
    sash.removeEventListener('pointerup', up);
    sash.removeEventListener('pointercancel', up);
    document.body.classList.remove('dragging');
    localStorage.setItem(SASH_KEY, Math.round(listPane.getBoundingClientRect().width));
  };
  sash.addEventListener('pointermove', move);
  sash.addEventListener('pointerup', up);
  sash.addEventListener('pointercancel', up);
});
sash.addEventListener('dblclick', () => {
  listPane.style.width = '';
  localStorage.removeItem(SASH_KEY);
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
