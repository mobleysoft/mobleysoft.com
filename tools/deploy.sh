#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TARGET=${MOBLEYSOFT_WEB_ROOT:-"$HOME/mobleysoft.com"}
STAGING="${TARGET}.stage.$$"
BACKUP=""

rollback() {
  if [ ! -e "$TARGET" ] && [ -n "$BACKUP" ] && [ -e "$BACKUP" ]; then
    mv "$BACKUP" "$TARGET"
  fi
  rm -rf "$STAGING"
}
trap rollback EXIT HUP INT TERM

python3 "$ROOT/tools/build_site.py"
python3 "$ROOT/tools/build_valuation.py"
python3 "$ROOT/tools/verify_site.py"
node --check "$ROOT/app.js"
node --check "$ROOT/blackhole.js"
node --check "$ROOT/valuation/app.js"

mkdir -p "$STAGING"
cp "$ROOT/index.html" "$STAGING/index.html"
cp "$ROOT/styles.css" "$STAGING/styles.css"
cp "$ROOT/app.js" "$STAGING/app.js"
cp "$ROOT/blackhole.js" "$STAGING/blackhole.js"
cp "$ROOT/favicon.svg" "$STAGING/favicon.svg"
cp "$ROOT/robots.txt" "$STAGING/robots.txt"
cp "$ROOT/sitemap.xml" "$STAGING/sitemap.xml"
cp "$ROOT/build.json" "$STAGING/build.json"
cp -R "$ROOT/assets" "$STAGING/assets"
cp -R "$ROOT/data" "$STAGING/data"
cp -R "$ROOT/products" "$STAGING/products"
cp -R "$ROOT/valuation" "$STAGING/valuation"
cp -R "$ROOT/backgrounds" "$STAGING/backgrounds"
cp -R "$ROOT/evolution" "$STAGING/evolution"
cp -R "$ROOT/genetic_timelapse" "$STAGING/genetic_timelapse"

if [ -e "$TARGET" ]; then
  BACKUP="${TARGET}.backup.$(date -u +%Y%m%dT%H%M%SZ)"
  mv "$TARGET" "$BACKUP"
fi
mv "$STAGING" "$TARGET"
trap - EXIT HUP INT TERM

printf 'Published %s\n' "$TARGET"
if [ -n "$BACKUP" ]; then
  printf 'Previous deployment preserved at %s\n' "$BACKUP"
fi
