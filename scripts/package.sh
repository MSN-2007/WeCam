#!/usr/bin/env bash
set -euo pipefail

# Packages CAMU AutoPass for Chrome/Chromium, Firefox, and Safari
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
VERSION="$(jq -r .version "$ROOT_DIR/manifest.json")"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR/chrome" "$DIST_DIR/firefox"

echo "==> Packaging CAMU AutoPass v${VERSION}..."

COMMON_FILES=(
  "background.js"
  "content.js"
  "popup.html"
  "popup.js"
  "popup.css"
  "README.md"
)

# 1. Package Chrome & Chromium (Service Worker only - zero warnings)
echo "--> Creating Chrome package (clean MV3 service worker)..."
for f in "${COMMON_FILES[@]}"; do
  cp "$ROOT_DIR/$f" "$DIST_DIR/chrome/"
done
cp -r "$ROOT_DIR/icons" "$DIST_DIR/chrome/"
cp "$ROOT_DIR/manifest.json" "$DIST_DIR/chrome/"

(cd "$DIST_DIR/chrome" && zip -r "$DIST_DIR/camu-autopass-chrome-v${VERSION}.zip" ./* > /dev/null)
echo "    Created dist/camu-autopass-chrome-v${VERSION}.zip"

# 2. Package Firefox & Gecko (Event Page background.scripts)
echo "--> Creating Firefox package (MV3 event pages)..."
for f in "${COMMON_FILES[@]}"; do
  cp "$ROOT_DIR/$f" "$DIST_DIR/firefox/"
done
cp -r "$ROOT_DIR/icons" "$DIST_DIR/firefox/"
jq '.background = { "scripts": ["background.js"] }' "$ROOT_DIR/manifest.json" > "$DIST_DIR/firefox/manifest.json"

(cd "$DIST_DIR/firefox" && zip -r "$DIST_DIR/camu-autopass-firefox-v${VERSION}.zip" ./* > /dev/null)
echo "    Created dist/camu-autopass-firefox-v${VERSION}.zip"

# 3. Universal package
(cd "$ROOT_DIR" && zip -r "$DIST_DIR/camu-autopass-v${VERSION}.zip" manifest.json background.js content.js popup.html popup.js popup.css README.md icons/ > /dev/null)
echo "    Created dist/camu-autopass-v${VERSION}.zip (universal/Chrome)"

echo "==> Packaging complete! Artifacts available in dist/"
