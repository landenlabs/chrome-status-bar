// Copyright LanDen Labs - Dennis Lang 2026
// Source: https://github.com/landenlabs/chrome-status-bar
// Author: https://landenlabs.com
// Licensed under the Apache License, Version 2.0 (see LICENSE).
// Runs inside iframes only. The bar lives in the top page and can't see into
// cross-origin frames (embedded YouTube/Vimeo players, video previews in search
// results), so report the hovered video's info up via background.js.
(() => {
  if (window.top === window) return;
  const { videoInfo, findVideo, VIDEO_EVENTS } = PSB_MEDIA;
  let current = null;

  function send(info) {
    try {
      chrome.runtime.sendMessage({ type: 'frame-video', info });
    } catch {
      // Extension was reloaded; this frame's script is orphaned until refresh.
    }
  }

  function report() {
    send(current ? videoInfo(current) : null);
  }

  document.addEventListener('mouseover', (e) => {
    const video = findVideo(e);
    if (video === current) return;
    current = video;
    report();
  }, true);

  document.documentElement.addEventListener('mouseleave', () => {
    if (!current) return;
    current = null;
    report();
  });

  for (const type of VIDEO_EVENTS) {
    document.addEventListener(type, (e) => {
      if (e.target === current) report();
    }, true);
  }
})();
