// Page Status Bar - permanent bottom bar with link/image counts and hover info.
(() => {
  const HOST_ID = '__page-status-bar-host';
  if (window.top !== window || document.getElementById(HOST_ID)) return;

  const BAR_HEIGHT = 22;
  const FONT = '12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const ELLIPSIS = '...';

  // ---------- Build the bar inside a closed shadow root (isolated from page CSS) ----------
  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText =
    `all:initial;position:fixed;left:0;right:0;bottom:0;height:${BAR_HEIGHT}px;` +
    'z-index:2147483647;display:block;';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      .bar {
        box-sizing: border-box; height: ${BAR_HEIGHT}px; width: 100%;
        display: flex; align-items: center; gap: 12px; padding: 0 8px;
        background: #1f2328; color: #e6edf3; border-top: 1px solid #444c56;
        font: ${FONT}; line-height: ${BAR_HEIGHT}px; white-space: nowrap;
        overflow: hidden; cursor: default; user-select: none;
      }
      .counts { flex: 0 0 auto; color: #9da7b3; }
      .counts b { color: #e6edf3; font-weight: 600; }
      .info { flex: 1 1 auto; min-width: 0; display: flex; gap: 10px; overflow: hidden; }
      .img { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; color: #f2cc60; }
      .url { flex: 1 1 0; min-width: 0; overflow: hidden; color: #79c0ff; }
      .info.has-img .img { max-width: 65%; }
      .url.src { color: #a5d6a7; }
    </style>
    <div class="bar">
      <span class="counts"></span>
      <span class="info"><span class="img"></span><span class="url"></span></span>
    </div>`;
  const countsEl = root.querySelector('.counts');
  const infoEl = root.querySelector('.info');
  const imgEl = root.querySelector('.img');
  const urlEl = root.querySelector('.url');
  document.documentElement.appendChild(host);

  // Keep page content from being hidden behind the bar.
  const pad = document.createElement('style');
  pad.textContent = `html { padding-bottom: ${BAR_HEIGHT}px !important; }`;
  (document.head || document.documentElement).appendChild(pad);

  // ---------- Counts ----------
  let countTimer = null;
  function updateCounts() {
    countTimer = null;
    const links = document.links.length;   // <a href> and <area href>
    const images = document.images.length; // <img>
    countsEl.innerHTML = `Links: <b>${links}</b> &nbsp; Images: <b>${images}</b>`;
  }
  function scheduleCounts() {
    if (!countTimer) countTimer = setTimeout(updateCounts, 500);
  }
  updateCounts();
  new MutationObserver(scheduleCounts).observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'src'],
  });

  // Re-attach if a page script wipes our element out.
  new MutationObserver(() => {
    if (!host.isConnected) document.documentElement.appendChild(host);
  }).observe(document.documentElement, { childList: true });

  // ---------- Text measurement + middle truncation ----------
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = FONT;
  const measure = (s) => ctx.measureText(s).width;

  // Keep the start and end of the text, cut out the middle.
  function truncateMiddle(text, maxWidth) {
    if (maxWidth <= 0) return '';
    if (measure(text) <= maxWidth) return text;
    let lo = 0, hi = text.length; // number of original chars kept
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (measure(cut(text, mid)) <= maxWidth) lo = mid; else hi = mid - 1;
    }
    return cut(text, lo);
  }
  function cut(text, keep) {
    const head = Math.ceil(keep / 2);
    const tail = keep - head;
    return text.slice(0, head) + ELLIPSIS + text.slice(text.length - tail);
  }

  // ---------- Helpers ----------
  const stripScheme = (url) => url.replace(/^https?:\/\//i, '');

  function linkHref(el) {
    const h = el.href;
    if (typeof h === 'string') return h;                // HTML <a>/<area>
    if (h && typeof h.baseVal === 'string') {           // SVG <a>
      try { return new URL(h.baseVal, document.baseURI).href; } catch { return h.baseVal; }
    }
    return el.getAttribute('href') || el.getAttribute('xlink:href') || '';
  }

  function formatBytes(n) {
    if (!n) return '';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  }

  function imageType(src) {
    if (src.startsWith('data:')) {
      const m = /^data:image\/([\w.+-]+)/i.exec(src);
      return m ? m[1].toUpperCase() : 'DATA';
    }
    if (src.startsWith('blob:')) return 'BLOB';
    try {
      const m = /\.([a-z0-9]{2,5})$/i.exec(new URL(src).pathname);
      return m ? m[1].toUpperCase() : '';
    } catch { return ''; }
  }

  function imageBytes(src) {
    if (src.startsWith('data:')) {
      const i = src.indexOf(',');
      const body = src.slice(i + 1);
      return /;base64,/i.test(src.slice(0, i + 1)) ? Math.floor(body.length * 3 / 4) : body.length;
    }
    // Only available for same-origin images or servers sending Timing-Allow-Origin.
    const e = performance.getEntriesByName(src)[0];
    return e ? (e.decodedBodySize || e.encodedBodySize || e.transferSize || 0) : 0;
  }

  function imageInfo(img) {
    const src = img.currentSrc || img.src || '';
    const r = img.getBoundingClientRect();
    const parts = [];
    if (img.complete && img.naturalWidth) {
      parts.push(`${img.naturalWidth}×${img.naturalHeight}`);
      const w = Math.round(r.width), h = Math.round(r.height);
      if (w !== img.naturalWidth || h !== img.naturalHeight) parts.push(`shown ${w}×${h}`);
    } else {
      parts.push(img.complete ? 'broken' : 'loading');
    }
    const type = imageType(src);
    if (type) parts.push(type);
    const size = formatBytes(imageBytes(src));
    if (size) parts.push(size);
    if (img.loading === 'lazy') parts.push('lazy');
    const alt = img.getAttribute('alt');
    if (alt) parts.push(`alt: "${alt.length > 60 ? alt.slice(0, 57) + ELLIPSIS : alt}"`);
    return { text: 'Image ' + parts.join(' · '), src };
  }

  // ---------- Hover rendering ----------
  let current = null; // { img, link }

  function render() {
    infoEl.classList.remove('has-img');
    urlEl.classList.remove('src');
    imgEl.textContent = '';
    urlEl.textContent = '';
    urlEl.title = '';
    if (!current) return;

    const { img, link } = current;
    let url = '';
    let prefix = '';
    if (img) {
      const info = imageInfo(img);
      imgEl.textContent = info.text;
      infoEl.classList.add('has-img');
      if (link) {
        url = linkHref(link);
        prefix = '→ ';
      } else if (info.src && !info.src.startsWith('data:')) {
        url = info.src;
        prefix = 'src: ';
        urlEl.classList.add('src');
      }
    } else if (link) {
      url = linkHref(link);
    }
    if (!url) return;

    const shown = stripScheme(url);
    urlEl.title = url;
    // Layout is synchronous: width available to the url span after the image text is placed.
    const avail = urlEl.getBoundingClientRect().width - measure(prefix) - 2;
    urlEl.textContent = prefix + truncateMiddle(shown, avail);
  }

  function setCurrent(next) {
    const same = (current && next && current.img === next.img && current.link === next.link) ||
                 (!current && !next);
    if (same) return;
    current = next;
    render();
  }

  document.addEventListener('mouseover', (e) => {
    let img = null, link = null;
    for (const el of e.composedPath()) {
      if (!(el instanceof Element)) continue;
      if (el === host) return; // hovering the bar itself: leave info as is
      if (!img && !link && el.localName === 'img') img = el;
      if (!link && (el.localName === 'a' || el.localName === 'area') && linkHref(el)) link = el;
      if (link) break;
    }
    setCurrent(img || link ? { img, link } : null);
  }, true);

  document.documentElement.addEventListener('mouseleave', () => setCurrent(null));
  window.addEventListener('resize', render);
  // Refresh image info once a hovered image finishes loading.
  document.addEventListener('load', (e) => {
    if (current && current.img === e.target) render();
  }, true);
})();
