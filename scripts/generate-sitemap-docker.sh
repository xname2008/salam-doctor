#!/usr/bin/env bash
# Regenerate pages-only sitemap.xml inside the backend container (Prisma + hubs).
set -euo pipefail
cd "$(dirname "$0")/.."

SITE_BASE="${SITE_BASE:-https://salam-doctor.com}"
export SITE_BASE

echo "Generating pages sitemap.xml..."

if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'salam-doctor-backend'; then
  echo "salam-doctor-backend not running; generating on host..."
  node scripts/generate-sitemap.js "$@"
else
  docker exec salam-doctor-backend mkdir -p /app/scripts/lib
  # Only copy non-mounted scripts (hub-slugs.js / clinicSlug.js are already volume-mounted).
  docker cp scripts/generate-sitemap.js salam-doctor-backend:/app/scripts/generate-sitemap.js
  docker exec -e SITE_BASE="$SITE_BASE" salam-doctor-backend node scripts/generate-sitemap.js "$@"
  docker cp salam-doctor-backend:/app/sitemap.xml ./sitemap.xml
fi

echo "Wrote ./sitemap.xml"
echo "  loc count: $(grep -c '<loc>' sitemap.xml || true)"
grep -E 'laser-hair-removal|/shiraz/botox' sitemap.xml || true
