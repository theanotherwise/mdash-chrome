#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

EXT_VERSION=$(cat manifest.json | jq -r ".version")
OUT="build/mdash-chrome-${EXT_VERSION}.zip"

rm -f build/mdash-chrome-*.zip

zip -r "$OUT" * \
    -x "build/*" \
    -x "**/.git/**" \
    -x "**/.DS_Store" \
    -x "**/node_modules/**" \
    -x "pack.sh" \
    -x "icons/*" \
    -x "AGENTS.md" \
    -x "README.md" \
    -x ".gitignore"

echo "Packed: $SCRIPT_DIR/$OUT"
