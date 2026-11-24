// Copyright LanDen Labs - Dennis Lang 2026
// Source: https://github.com/landenlabs/chrome-status-bar
// Author: https://landenlabs.com
// Licensed under the Apache License, Version 2.0 (see LICENSE).
// Page Status Bar - permanent top/bottom bar with link/image counts and hover info.
(() => {
  const HOST_ID = '__page-status-bar-host';
  if (window.top !== window || document.getElementById(HOST_ID)) return; // frames: see frame.js
  const { imageType, videoInfo, findVideo, VIDEO_EVENTS } = PSB_MEDIA;

  const BAR_HEIGHT = 22;
  const FONT = '12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const ELLIPSIS = '...';

  // ---------- Build the bar inside a closed shadow root (isolated from page CSS) ----------
  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText =
    `all:initial;position:fixed;left:0;right:0;height:${BAR_HEIGHT}px;` +
    'z-index:2147483647;display:block;';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      .bar {
        box-sizing: border-box; height: ${BAR_HEIGHT}px; width: 100%;
        display: flex; align-items: center; gap: 12px; padding: 0 8px;
        background: #1f2328; color: #e6edf3; border: 0 solid #444c56;
        font: ${FONT}; line-height: ${BAR_HEIGHT}px; white-space: nowrap;
        overflow: hidden; cursor: default; user-select: none;
      }
      .counts { flex: 0 0 auto; display: flex; gap: 4px; }
      .counts button {
        all: unset; box-sizing: border-box; height: 18px; padding: 0 6px;
        border: 1px solid #444c56; border-radius: 4px; color: #9da7b3;
        font: ${FONT}; line-height: 16px; cursor: pointer;
      }
      .counts button:hover { background: #30363d; border-color: #768390; }
      .counts button:focus-visible { outline: 1px solid #79c0ff; }
      .counts b { color: #e6edf3; font-weight: 600; }
      .info { flex: 1 1 auto; min-width: 0; display: flex; gap: 10px; overflow: hidden; }
      .img { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; color: #f2cc60; }
      .url { flex: 1 1 0; min-width: 0; overflow: hidden; color: #79c0ff; }
      .info.has-img .img { max-width: 65%; }
      .url.src { color: #a5d6a7; }
      :host([data-pos="bottom"]) .bar { border-top-width: 1px; }
      :host([data-pos="top"]) .bar { border-bottom-width: 1px; }
    </style>
    <div class="bar">
      <span class="counts">
        <button type="button" class="links" title="List all links in a new tab">Links: <b>0</b></button>
        <button type="button" class="images" title="List all images in a new tab">Images: <b>0</b></button>
      </span>
      <span class="info"><span class="img"></span><span class="url"></span></span>
    </div>`;
  const linksBtn = root.querySelector('button.links');
  const imagesBtn = root.querySelector('button.images');
  const infoEl = root.querySelector('.info');
  const imgEl = root.querySelector('.img');
  const urlEl = root.querySelector('.url');

  // Keep page content from being hidden behind the bar.
  const pad = document.createElement('style');

  // ---------- Position (top/bottom), stored in chrome.storage.sync ----------
  let barPos = null;
  function applyPosition(pos) {
    pos = pos === 'bottom' ? 'bottom' : 'top';
    if (barPos && barPos !== pos) restoreShifted();
    barPos = pos;
    host.setAttribute('data-pos', pos);
    host.style.top = pos === 'top' ? '0' : 'auto';
    host.style.bottom = pos === 'bottom' ? '0' : 'auto';
    pad.textContent = `html { padding-${pos}: ${BAR_HEIGHT}px !important; }`;
    if (!host.isConnected) document.documentElement.appendChild(host);
    if (!pad.isConnected) (document.head || document.documentElement).appendChild(pad);
    shiftFixed();
  }

  // ---------- Push fixed/sticky page elements out from under the bar ----------
  // Padding on <html> moves normal content, but fixed and sticky elements (site
  // headers, nav bars, cookie banners) are placed relative to the viewport, so
  // they would still sit under the bar. Offset the ones touching the bar's edge.
  const shifted = new Map(); // el -> { prop, value, priority } (original inline style)
  function restoreShifted() {
    for (const [el, o] of shifted) {
      if (o.value) el.style.setProperty(o.prop, o.value, o.priority);
      else el.style.removeProperty(o.prop);
    }
    shifted.clear();
  }
  function shiftFixed() {
    shiftTimer = null;
    if (!barPos || !document.body) return;
    const prop = barPos; // 'top' or 'bottom'
    for (const el of shifted.keys()) if (!el.isConnected) shifted.delete(el);
    for (const el of document.body.querySelectorAll('*')) {
      if (shifted.has(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
      if (cs.display === 'none') continue;
      const v = parseFloat(cs[prop]);
      if (!(v >= 0 && v < BAR_HEIGHT)) continue; // 'auto' -> NaN, skipped
      shifted.set(el, {
        prop,
        value: el.style.getPropertyValue(prop),
        priority: el.style.getPropertyPriority(prop),
      });
      el.style.setProperty(prop, `${v + BAR_HEIGHT}px`, 'important');
    }
  }
  let shiftTimer = null;
  function scheduleShift() {
    if (!shiftTimer) shiftTimer = setTimeout(shiftFixed, 1000);
  }
  // Pages add headers late or switch them to fixed via a class change on scroll.
  new MutationObserver(scheduleShift).observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['class'],
  });

  // The bar is attached once the stored setting is known, so it doesn't jump.
  chrome.storage.sync.get({ position: 'top' }, (s) => applyPosition(s && s.position));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.position) applyPosition(changes.position.newValue);
  });

  // ---------- Counts ----------
  let countTimer = null;
  function updateCounts() {
    countTimer = null;
    const links = document.links.length;   // <a href> and <area href>
    const images = document.images.length; // <img>
    linksBtn.querySelector('b').textContent = links;
    imagesBtn.querySelector('b').textContent = images;
  }
  function scheduleCounts() {
    if (!countTimer) countTimer = setTimeout(updateCounts, 500);
  }
  updateCounts();
  new MutationObserver(scheduleCounts).observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'src'],
  });

  // ---------- Lists (opened in a new tab by background.js) ----------
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  // Long data: URLs (inline images) would bloat storage; keep only their start.
  const shortUrl = (u) => (u.startsWith('data:') && u.length > 300 ? u.slice(0, 300) + ELLIPSIS : u);

  function linkText(a) {
    let t = clean(a.textContent) || clean(a.getAttribute('aria-label')) || clean(a.getAttribute('title'));
    if (!t) {
      const img = a.querySelector('img[alt]');
      if (img && clean(img.alt)) t = `[image] ${clean(img.alt)}`;
      else if (a.querySelector('img, svg')) t = '[image]';
    }
    return t;
  }

  function collectLinks() {
    return Array.from(document.links, (a) => ({ text: linkText(a), url: shortUrl(linkHref(a)) }));
  }

  function collectImages() {
    return Array.from(document.images, (img) => {
      const parts = [];
      if (img.naturalWidth) parts.push(`${img.naturalWidth}×${img.naturalHeight}`);
      else parts.push(img.complete ? 'broken' : 'not loaded');
      const type = imageType(img.currentSrc || img.src || '');
      if (type) parts.push(type);
      return {
        text: clean(img.getAttribute('alt')) || clean(img.getAttribute('title')),
        info: parts.join(' · '),
        url: shortUrl(img.currentSrc || img.src || ''),
      };
    });
  }

  function openList(kind) {
    const items = kind === 'images' ? collectImages() : collectLinks();
    try {
      chrome.runtime.sendMessage({
        type: 'open-list', kind, items, pageUrl: location.href, pageTitle: document.title,
      });
    } catch {
      // Extension was reloaded; this page's copy of the script is orphaned until refresh.
    }
  }
  linksBtn.addEventListener('click', () => openList('links'));
  imagesBtn.addEventListener('click', () => openList('images'));

  // Re-attach if a page script wipes our element out.
  new MutationObserver(() => {
    if (!host.isConnected && host.hasAttribute('data-pos')) document.documentElement.appendChild(host);
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

  // ---------- Video ----------
  const VIDEO_EXT = /\.(mp4|m4v|webm|mov|mkv|avi|ogv|flv|wmv|mpe?g|3gp|m3u8|mpd)$/i;

  // Video sites whose page links can be recognised from the URL alone.
  function videoSite(u) {
    const h = u.hostname.replace(/^(www|m|music)\./, '');
    const p = u.pathname;
    if ((h === 'youtube.com' || h === 'youtube-nocookie.com') &&
        (p === '/watch' || /^\/(shorts|embed|live)\//.test(p))) return 'YouTube';
    if (h === 'youtu.be' && p.length > 1) return 'YouTube';
    if ((h === 'vimeo.com' || h === 'player.vimeo.com') && /\/\d+/.test(p)) return 'Vimeo';
    if ((h === 'dailymotion.com' && p.startsWith('/video/')) || h === 'dai.ly') return 'Dailymotion';
    if (h === 'tiktok.com' && p.includes('/video/')) return 'TikTok';
    if (h === 'twitch.tv' && p.includes('/videos/')) return 'Twitch';
    return '';
  }

  // A link to a video: only what the URL (and the page around it) tells us,
  // nothing is downloaded. Search results and thumbnails usually print the
  // duration inside the link, so pick that up for video-site links.
  function videoLinkInfo(link, url) {
    let u;
    try { u = new URL(url); } catch { return ''; }
    const m = VIDEO_EXT.exec(u.pathname);
    if (m) {
      const ext = m[1].toLowerCase();
      const kind = ext === 'm3u8' ? 'HLS stream' : ext === 'mpd' ? 'DASH stream' : ext.toUpperCase();
      return `Video link · ${kind}`;
    }
    const site = videoSite(u);
    if (!site) return '';
    const parts = [`Video link · ${site}`];
    const d = /(?:^|\s)((?:\d{1,2}:)?\d{1,2}:\d{2})(?=\s|$)/.exec(link.innerText || '');
    if (d) parts.push(d[1]);
    return parts.join(' · ');
  }

  // ---------- Hover rendering ----------
  let current = null; // { img, video, link } or { frame: { text, src } } from frame.js

  function render() {
    infoEl.classList.remove('has-img');
    urlEl.classList.remove('src');
    imgEl.textContent = '';
    urlEl.textContent = '';
    urlEl.title = '';
    if (!current) return;

    const { img, video, link, frame } = current;
    let url = '';
    let prefix = '';
    const media = frame || (img ? imageInfo(img) : video ? videoInfo(video) : null);
    if (media) {
      imgEl.textContent = media.text;
      infoEl.classList.add('has-img');
      if (link) {
        url = linkHref(link);
        prefix = '→ ';
      } else if (media.src && !/^(data|blob):/i.test(media.src)) {
        url = media.src;
        prefix = 'src: ';
        urlEl.classList.add('src');
      }
    } else if (link) {
      url = linkHref(link);
      const vl = videoLinkInfo(link, url);
      if (vl) {
        imgEl.textContent = vl;
        infoEl.classList.add('has-img');
      }
    }
    if (!url) return;

    const shown = stripScheme(url);
    urlEl.title = url;
    // Layout is synchronous: width available to the url span after the media text is placed.
    const avail = urlEl.getBoundingClientRect().width - measure(prefix) - 2;
    urlEl.textContent = prefix + truncateMiddle(shown, avail);
  }

  function setCurrent(next) {
    const same = (current && next && !next.frame && current.img === next.img &&
                  current.video === next.video && current.link === next.link) ||
                 (!current && !next);
    if (same) return;
    current = next;
    render();
  }

  document.addEventListener('mouseover', (e) => {
    let img = null, video = null, link = null;
    for (const el of e.composedPath()) {
      if (!(el instanceof Element)) continue;
      if (el === host) return; // hovering the bar itself: leave info as is
      if (!img && !video && !link && el.localName === 'img') img = el;
      if (!img && !video && !link && el.localName === 'video') video = el;
      if (!link && (el.localName === 'a' || el.localName === 'area') && linkHref(el)) link = el;
      if (link) break;
    }
    if (!img && !video) video = findVideo(e);
    setCurrent(img || video || link ? { img, video, link } : null);
  }, true);

  document.documentElement.addEventListener('mouseleave', () => setCurrent(null));
  window.addEventListener('resize', render);
  // Refresh image info once a hovered image finishes loading.
  document.addEventListener('load', (e) => {
    if (current && current.img === e.target) render();
  }, true);
  // Refresh video info as metadata arrives or playback state changes.
  for (const type of VIDEO_EVENTS) {
    document.addEventListener(type, (e) => {
      if (current && current.video === e.target) render();
    }, true);
  }

  // Videos inside iframes (e.g. embedded YouTube players) are reported by
  // frame.js, relayed through background.js.
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== 'frame-video') return;
    if (msg.info) setCurrent({ frame: { text: String(msg.info.text || ''), src: String(msg.info.src || '') } });
    else if (current && current.frame) setCurrent(null);
  });
})();
