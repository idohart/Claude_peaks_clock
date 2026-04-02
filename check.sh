#!/usr/bin/env bash
set -euo pipefail

echo "=== Constraint checks ==="
npx tsc --noEmit
npx eslint .

APP_IMPORTS_SERVER=$(grep -R -n "from ['\\\"].*server/" src/app src/services src/lib src/types 2>/dev/null || true)
if [ -n "$APP_IMPORTS_SERVER" ]; then
  echo "Frontend code imports from server/."
  echo "Keep scraping and HTTP concerns in the backend."
  echo "$APP_IMPORTS_SERVER"
  exit 1
fi

LIB_IMPORTS_SERVICES=$(grep -R -n "from ['\\\"].*services/" src/lib src/types 2>/dev/null || true)
if [ -n "$LIB_IMPORTS_SERVICES" ]; then
  echo "Low-level helpers import from src/services."
  echo "src/lib and src/types may not depend on src/services."
  echo "$LIB_IMPORTS_SERVICES"
  exit 1
fi

SERVER_IMPORTS_APP=$(grep -R -n "from ['\\\"].*src/app/" server 2>/dev/null || true)
if [ -n "$SERVER_IMPORTS_APP" ]; then
  echo "Backend imports from src/app."
  echo "The backend may share types with src/types, but must not depend on React components."
  echo "$SERVER_IMPORTS_APP"
  exit 1
fi

echo "=== Checks passed ==="
