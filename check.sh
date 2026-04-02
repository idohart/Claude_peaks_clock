#!/usr/bin/env bash
set -euo pipefail

echo "=== Constraint checks ==="
npx tsc --noEmit
npx eslint .

UI_IMPORTS_DATA=$(grep -R -n "from ['\\\"].*data/" src/ui src/App.tsx 2>/dev/null || true)
if [ -n "$UI_IMPORTS_DATA" ]; then
  echo "UI code imports from src/data."
  echo "Move data access into src/services so UI stays presentational."
  echo "$UI_IMPORTS_DATA"
  exit 1
fi

LIB_IMPORTS_SERVICES=$(grep -R -n "from ['\\\"].*services/" src/lib src/types 2>/dev/null || true)
if [ -n "$LIB_IMPORTS_SERVICES" ]; then
  echo "Low-level helpers import from src/services."
  echo "src/lib and src/types may not depend on src/services."
  echo "$LIB_IMPORTS_SERVICES"
  exit 1
fi

echo "=== Checks passed ==="
