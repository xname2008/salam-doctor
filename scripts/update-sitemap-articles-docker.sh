#!/usr/bin/env bash
# Merge articles/*.html into sitemap.xml — no database or Prisma required.
#
#   bash scripts/update-sitemap-articles-docker.sh --dry-run
#   bash scripts/update-sitemap-articles-docker.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Syncing static article URLs into sitemap.xml..."
docker compose run --rm --no-deps \
  -v "$(pwd)/scripts/update-sitemap-articles.js:/app/scripts/update-sitemap-articles.js:ro" \
  -v "$(pwd)/scripts/lib/static-articles-sitemap.js:/app/scripts/lib/static-articles-sitemap.js:ro" \
  -v "$(pwd)/articles:/app/articles:ro" \
  -v "$(pwd)/sitemap.xml:/app/sitemap.xml:rw" \
  -e "SITE_BASE=${SITE_BASE:-https://salam-doctor.com}" \
  backend node scripts/update-sitemap-articles.js "$@"

echo
echo "Verify:"
echo "  grep '/articles/' sitemap.xml"
echo "  curl -sI https://salam-doctor.com/sitemap.xml | head -1"
