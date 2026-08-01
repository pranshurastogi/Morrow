#!/usr/bin/env bash
set -euo pipefail

bun run build
bun run lint
bun run test
git diff --check
