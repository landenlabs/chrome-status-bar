#!/usr/bin/env bash
# Copyright LanDen Labs - Dennis Lang 2026 | https://github.com/landenlabs/chrome-status-bar
#
# Build the Chrome Web Store upload zip: dist/page-status-bar-<version>.zip
# Only the files the extension needs at run time are included (an allow list),
# so docs/, screens/, README, store listing, git files, etc. are left out.

set -euo pipefail
cd "$(dirname "$0")"

# Files packaged into the zip. Add new run-time files here.
FILES=(
  manifest.json
  background.js
  content.js
  frame.js
  media.js
  options.html
  options.js
  list.html
  list.js
  icons/icon16.png
  icons/icon32.png
  icons/icon48.png
  icons/icon128.png
  LICENSE
  NOTICE
)

VERSION=$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' manifest.json | head -1)
if [[ -z "$VERSION" ]]; then
  echo "ERROR: could not read version from manifest.json" >&2
  exit 1
fi

for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: missing file: $f" >&2
    exit 1
  fi
done

mkdir -p dist
ZIP="dist/page-status-bar-${VERSION}.zip"
rm -f "$ZIP"

# -X: leave out macOS extra attributes, -q: quiet
zip -X -q "$ZIP" "${FILES[@]}"

echo "Built $ZIP"
unzip -l "$ZIP"
