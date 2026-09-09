#!/usr/bin/env bash
# Full sitemap refresh for deploy/CI: hub pages (DB) + static articles/*.html
#
# Run after adding a new article HTML file or deploying hub/service changes:
#   bash scripts/deploy-sync-sitemap.sh
#
# Articles-only (no DB / Prisma):
#   bash scripts/update-sitemap-articles-docker.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Step 1/2: Regenerate canonical sitemap (static pages + /shiraz hubs + DB)"
bash scripts/generate-sitemap-docker.sh

echo
echo "==> Step 2/2: Merge static articles/*.html (idempotent; safe after full regen)"
bash scripts/update-sitemap-articles-docker.sh

echo
echo "Done. Purge CDN cache for /sitemap.xml if applicable."
