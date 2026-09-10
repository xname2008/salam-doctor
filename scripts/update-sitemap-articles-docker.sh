#!/usr/bin/env bash
# Build sitemap-articles.xml only — never touches sitemap.xml.
set -euo pipefail
cd "$(dirname "$0")/.."

SITE_BASE="${SITE_BASE:-https://salam-doctor.com}"
export SITE_BASE

echo "Building sitemap-articles.xml (articles only)..."
node scripts/update-sitemap-articles.js "$@"

echo "Wrote ./sitemap-articles.xml"
echo "  loc count: $(grep -c '<loc>' sitemap-articles.xml || true)"
grep '/articles/' sitemap-articles.xml || true
echo "Confirmed: this script does not write sitemap.xml."
