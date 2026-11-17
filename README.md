# Page Status Bar

Adds a permanent status bar to the bottom (or top) of every page showing:

- Link and image counts for the current page (updated as the page changes).
- Image info when hovering over an image.
- The target URL when hovering over a link.

The bar is rendered inside a closed shadow root so page CSS can't affect it
(and it can't affect the page). It only runs in the top-level frame.

## Settings

Open the options (right-click the extension icon → **Options**, or
`chrome://extensions` → **Details** → **Extension options**) to choose whether
the bar sits at the **bottom** (default) or **top** of the page. Open tabs
update right away.

Note: Chrome's own link-hover URL bubble (bottom-left of the window) can't be
hidden or moved by an extension. Putting this bar at the top keeps the two from
overlapping.

## Load / reload the extension

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this `chrome-status-bar` folder (or
   click the reload icon on the existing card after making changes).
4. Open or reload any page — the status bar appears at the bottom.

## Files

- `manifest.json` — Manifest V3; injects `content.js` on `<all_urls>`.
- `content.js` — builds the bar and handles counts and hover info.
- `options.html` / `options.js` — settings page (bar position, saved in
  `chrome.storage.sync`).
- `icons/` — `icon.svg` (48/128 px) and `icon-small.svg` (16/32 px) sources,
  plus the rendered `icon16/32/48/128.png` used by the manifest.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
