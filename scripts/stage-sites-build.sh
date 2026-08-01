#!/usr/bin/env bash
set -euo pipefail

rm -rf dist
mkdir -p dist/server dist/client dist/.openai

cp -R .output/server/. dist/server/
cp .output/server/index.mjs dist/server/index.js
cp -R .output/public/. dist/client/
cp .openai/hosting.json dist/.openai/hosting.json
