#!/bin/bash

EXT_VERSION=$(cat manifest.json | jq -r ".version")
OUT="build/mdash-chrome-${EXT_VERSION}.zip"

zip -r "$OUT" * \
    -x "build/*" \
    -x "**/.git/**" \
    -x "**/.DS_Store" \
    -x "**/node_modules/**" \
    -x "pack.sh" \
    -x "icons/*" \
    -x "AGENTS.md" \
    -x "STORE_DESCRIPTION.txt" \
    -x ".gitignore"

echo "Packed: $OUT"
