#!/usr/bin/env bash
set -euo pipefail

# Run on an Intel Mac with Xcode Command Line Tools, Node.js and npm installed.
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_ROOT="$PROJECT_ROOT/native/macos-build"
OUTPUT_ROOT="$PROJECT_ROOT/native/darwin-x64"
HEADERS="$BUILD_ROOT/node-v1.8.6.tar.gz"
HEADERS_URL="https://artifacts.electronjs.org/headers/dist/v1.8.6/node-v1.8.6.tar.gz"
HEADERS_SHA256="9973e36164b5b71d8486b5827eb283d46f155d3ee12c457639316d6ad4024b75"

if [ "$(uname -s)" != Darwin ] || [ "$(uname -m)" != x86_64 ]; then
  echo "Run this script on an Intel Mac (x86_64)." >&2
  exit 1
fi

cd "$BUILD_ROOT"
if [ ! -f "$HEADERS" ]; then
  curl --fail --location --retry 3 "$HEADERS_URL" --output "$HEADERS"
fi
printf '%s  %s\n' "$HEADERS_SHA256" "$HEADERS" | shasum -a 256 --check

npm ci --ignore-scripts --no-audit --no-fund --legacy-peer-deps
NODE_GYP="$BUILD_ROOT/node_modules/.bin/node-gyp"

build_addon() {
  local package_name="$1"
  shift
  echo "Building $package_name for Electron 1.8.6 / macOS x64"
  (
    cd "$BUILD_ROOT/node_modules/$package_name"
    "$NODE_GYP" rebuild \
      --target=1.8.6 \
      --arch=x64 \
      --dist-url=https://electronjs.org/headers \
      --tarball="$HEADERS" \
      "$@"
  )
}

build_addon vk-flex
build_addon cld
build_addon spellchecker
build_addon keyboard-layout
build_addon sqlite3 \
  --module_name=node_sqlite3 \
  --module_path=lib/binding/electron-v1.8-darwin-x64

mkdir -p "$OUTPUT_ROOT/dist"
cp "$BUILD_ROOT/node_modules/vk-flex/build/Release/vkext_flex.node" \
  "$OUTPUT_ROOT/dist/0f8e273eea4548333d8624cca9dfdc81.node"
cp "$BUILD_ROOT/node_modules/cld/build/Release/cld.node" \
  "$OUTPUT_ROOT/dist/63f5da0a611e33b4062e0f4d3f55fece.node"
cp "$BUILD_ROOT/node_modules/spellchecker/build/Release/spellchecker.node" \
  "$OUTPUT_ROOT/dist/977161663b9dbd9aecc1a0b55c331c52.node"
cp "$BUILD_ROOT/node_modules/keyboard-layout/build/Release/keyboard-layout-manager.node" \
  "$OUTPUT_ROOT/dist/d491abcfdbdbdc5687428004350f6b37.node"

SQLITE_OUTPUT="$OUTPUT_ROOT/node_modules/sqlite3/lib/binding/electron-v1.8-darwin-x64"
mkdir -p "$SQLITE_OUTPUT"
cp "$BUILD_ROOT/node_modules/sqlite3/build/Release/node_sqlite3.node" \
  "$SQLITE_OUTPUT/node_sqlite3.node"

for binary in "$OUTPUT_ROOT"/dist/*.node "$SQLITE_OUTPUT/node_sqlite3.node"; do
  lipo -verify_arch x86_64 "$binary"
done

cd "$PROJECT_ROOT"
npm install --ignore-scripts --no-audit --no-fund
npm run check:mac
npm run build:mac
echo "Created release/OpenVK-darwin-x64/OpenVK.app"
