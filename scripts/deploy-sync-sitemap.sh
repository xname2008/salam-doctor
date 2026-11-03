#!/usr/bin/env bash
# Full sitemap refresh: pages sitemap.xml + articles sitemap-articles.xml
#
# Run after adding a new article HTML file or deploying hub/service changes:
#   bash scripts/deploy-sync-sitemap.sh
#
# Articles-only (never touches pages sitemap):
#   bash scripts/update-sitemap-articles-docker.sh
#   # or: npm run sitemap:articles / npm run articles:sync
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Step 1/2: Regenerate pages-only sitemap.xml (static + /shiraz hubs + doctors)"
bash scripts/generate-sitemap-docker.sh

echo
echo "==> Step 2/2: Write sitemap-articles.xml only (does NOT touch sitemap.xml)"
bash scripts/update-sitemap-articles-docker.sh

echo
echo "Done."
echo "  pages:    $(grep -c '<loc>' sitemap.xml || echo 0) locs in sitemap.xml"
echo "  articles: $(grep -c '<loc>' sitemap-articles.xml || echo 0) locs in sitemap-articles.xml"
echo "Purge CDN cache for /sitemap.xml and /sitemap-articles.xml if applicable."
