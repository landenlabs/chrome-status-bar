// Copyright LanDen Labs - Dennis Lang 2026
// Source: https://github.com/landenlabs/chrome-status-bar
// Author: https://landenlabs.com
// Licensed under the Apache License, Version 2.0 (see LICENSE).
// Options page: choose where the status bar is shown. Open tabs update live.
const radios = document.querySelectorAll('input[name="position"]');
const saved = document.getElementById('saved');
let hideTimer = null;

chrome.storage.sync.get({ position: 'top' }, ({ position }) => {
  for (const r of radios) r.checked = r.value === position;
});

for (const r of radios) {
  r.addEventListener('change', () => {
    if (!r.checked) return;
    chrome.storage.sync.set({ position: r.value }, () => {
      saved.style.visibility = 'visible';
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => { saved.style.visibility = 'hidden'; }, 1200);
    });
  });
}
