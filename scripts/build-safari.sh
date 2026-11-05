#!/usr/bin/env bash
set -euo pipefail

# Build Safari App Extension for CAMU AutoPass
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Building CAMU AutoPass for Safari (macOS)..."
xcodebuild -project "$ROOT_DIR/safari/CAMU AutoPass/CAMU AutoPass.xcodeproj" \
  -scheme "CAMU AutoPass (macOS)" \
  -destination 'generic/platform=macOS' \
  CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO CODE_SIGN_ENTITLEMENTS="" CODE_SIGNING_ALLOWED=NO \
  clean build

echo ""
echo "==> Build complete! The macOS app and Safari extension are ready."
echo "==> To run in Safari:"
echo "    1. Open Safari -> Settings -> Advanced -> Check 'Show features for web developers'."
echo "    2. In the menu bar, open 'Develop' -> Check 'Allow Unsigned Extensions'."
echo "    3. Double-click safari/CAMU AutoPass/CAMU AutoPass.xcodeproj and press Command+R in Xcode."
