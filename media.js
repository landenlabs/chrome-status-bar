// Copyright LanDen Labs - Dennis Lang 2026
// Source: https://github.com/landenlabs/chrome-status-bar
// Author: https://landenlabs.com
// Licensed under the Apache License, Version 2.0 (see LICENSE).
// Media helpers shared by content.js (top page) and frame.js (inside iframes,
// e.g. embedded YouTube players). Loaded first in every frame; exposes PSB_MEDIA.
var PSB_MEDIA = PSB_MEDIA || (() => {
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

  function formatDuration(sec) {
    if (sec === Infinity) return 'live';
    if (!Number.isFinite(sec) || sec <= 0) return '';
    sec = Math.round(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const pad2 = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
  }

  function videoType(v, src) {
    const source = v.querySelector('source[type]');
    const mime = source ? source.getAttribute('type') : '';
    const m = /^video\/([\w.+-]+)/i.exec(mime || '');
    if (m) return m[1].replace(/^x-/i, '').toUpperCase();
    if (src.startsWith('blob:')) return 'stream'; // MediaSource player (YouTube etc.)
    return imageType(src);
  }

  // File size is left out: video is fetched in ranges, so timing entries are partial.
  function videoInfo(v) {
    const source = v.querySelector('source[src]');
    const src = v.currentSrc || v.src || (source ? source.src : '');
    const r = v.getBoundingClientRect();
    const parts = [];
    if (v.readyState >= 1 && v.videoWidth) {
      parts.push(`${v.videoWidth}×${v.videoHeight}`);
      const w = Math.round(r.width), h = Math.round(r.height);
      if (w !== v.videoWidth || h !== v.videoHeight) parts.push(`shown ${w}×${h}`);
    } else {
      parts.push(v.error ? 'error' : 'loading');
    }
    const dur = formatDuration(v.duration);
    if (dur) parts.push(dur);
    const type = videoType(v, src);
    if (type) parts.push(type);
    parts.push(v.paused ? 'paused' : 'playing');
    if (v.muted || v.volume === 0) parts.push('muted');
    if (v.loop) parts.push('loop');
    return { text: 'Video ' + parts.join(' · '), src };
  }

  // Video under the mouse: in the event path, or underneath the player's
  // control overlays (which usually cover the <video> element).
  function findVideo(e) {
    for (const el of e.composedPath()) {
      if (el instanceof Element && el.localName === 'video') return el;
    }
    for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
      if (el.localName === 'video') return el;
    }
    return null;
  }

  // Events after which hovered-video info should be re-read.
  const VIDEO_EVENTS = ['loadedmetadata', 'durationchange', 'resize', 'play', 'pause', 'volumechange', 'error'];

  return { imageType, videoInfo, findVideo, VIDEO_EVENTS };
})();
