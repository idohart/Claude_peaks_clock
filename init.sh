#!/usr/bin/env bash
set -euo pipefail

echo "=== Claude Promotion Clock init ==="

if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
  npm install
fi

if [ -f "check.sh" ]; then
  bash check.sh
fi

echo "=== Ready ==="
