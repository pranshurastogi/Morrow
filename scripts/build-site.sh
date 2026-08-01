#!/usr/bin/env bash
set -euo pipefail

rm -rf .output dist
vite build
bash scripts/stage-sites-build.sh
