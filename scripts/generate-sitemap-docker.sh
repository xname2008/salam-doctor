#!/usr/bin/env bash
# Regenerate sitemap.xml from the live DB via the backend container (has
# @prisma/client + DATABASE_URL). The host sitemap.xml is bind-mounted rw so
# the file nginx serves is updated in place. No image rebuild needed.
#
#   bash scripts/generate-sitemap-docker.sh --dry-run   # preview, writes nothing
#   bash scripts/generate-sitemap-docker.sh             # write sitemap.xml
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Generating canonical sitemap.xml inside Docker..."
docker compose run --rm --no-deps \
  -v "$(pwd)/scripts/generate-sitemap.js:/app/scripts/generate-sitemap.js:ro" \
  -v "$(pwd)/scripts/lib/static-articles-sitemap.js:/app/scripts/lib/static-articles-sitemap.js:ro" \
  -v "$(pwd)/hub-slugs.js:/app/hub-slugs.js:ro" \
  -v "$(pwd)/articles:/app/articles:ro" \
  -v "$(pwd)/sitemap.xml:/app/sitemap.xml:rw" \
  -e "SITE_BASE=${SITE_BASE:-https://salam-doctor.com}" \
  backend node scripts/generate-sitemap.js "$@"

echo
echo "Verify (should be 200, no redirect, and list /shiraz/* URLs):"
echo "  curl -sI https://salam-doctor.ir/sitemap.xml | head -1"
echo "  grep -c '<loc>https://salam-doctor.ir/shiraz/' sitemap.xml"
