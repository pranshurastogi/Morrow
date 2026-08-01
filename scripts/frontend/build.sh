#!/usr/bin/env bash
set -euo pipefail

MORROW_NITRO_PRESET="${NITRO_PRESET:-node-server}"
NITRO_PRESET="${MORROW_NITRO_PRESET}" vite build
