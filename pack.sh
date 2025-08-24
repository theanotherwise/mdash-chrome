#!/bin/bash

EXT_VERSION=`cat manifest.json  | jq -r ".version"`

zip -r ../mdash-chrome-${EXT_VERSION}.zip * -x "**/.git/**" "**/.DS_Store" "**/node_modules/**" -x "./pack.sh"