# Page Status Bar

Adds a permanent status bar to the bottom of every page showing:

- Link and image counts for the current page (updated as the page changes).
- Image info when hovering over an image.
- The target URL when hovering over a link.

The bar is rendered inside a closed shadow root so page CSS can't affect it
(and it can't affect the page). It only runs in the top-level frame.

## Load / reload the extension

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this `chrome-status-bar` folder (or
   click the reload icon on the existing card after making changes).
4. Open or reload any page — the status bar appears at the bottom.

## Files

- `manifest.json` — Manifest V3; injects `content.js` on `<all_urls>`.
- `content.js` — builds the bar and handles counts and hover info.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
