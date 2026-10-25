#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ICONSET="$PROJECT_ROOT/.stage/OpenVK.iconset"
mkdir -p "$ICONSET"

for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$PROJECT_ROOT/assets/logo256.png" \
    --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  retina=$((size * 2))
  sips -z "$retina" "$retina" "$PROJECT_ROOT/assets/logo256.png" \
    --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done

iconutil -c icns "$ICONSET" -o "$PROJECT_ROOT/assets/OpenVK.icns"
echo "Created assets/OpenVK.icns"
