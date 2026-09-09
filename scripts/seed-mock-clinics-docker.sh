#!/usr/bin/env bash
# Seed mock clinics into Postgres via the backend container (has @prisma/client
# generated + DATABASE_URL from .env). No image rebuild required — the seeder is
# bind-mounted in. Flags pass through, e.g.:
#   bash scripts/seed-mock-clinics-docker.sh --dry-run
#   bash scripts/seed-mock-clinics-docker.sh
#   bash scripts/seed-mock-clinics-docker.sh --purge
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Seeding mock clinics inside Docker..."
docker compose run --rm --no-deps \
  -v "$(pwd)/prisma/seed-mock-clinics.js:/app/prisma/seed-mock-clinics.js:ro" \
  backend node prisma/seed-mock-clinics.js "$@"

echo
echo "Restarting backend to clear the 5-min page cache..."
docker compose restart backend >/dev/null 2>&1 || true

# Keep sitemap.xml in sync with the services now present in the DB (skipped for
# preview runs; --purge still regenerates so removed pages drop out promptly).
if [[ " $* " != *" --dry-run "* ]]; then
  echo
  echo "Regenerating canonical sitemap.xml from the DB..."
  bash scripts/generate-sitemap-docker.sh
fi

echo "Done. Verify a previously-empty page, e.g.:"
echo "  curl -s https://salam-doctor.ir/shiraz/botox | grep -c 'card-premium\\|clinic-cards'"
echo "  curl -s https://salam-doctor.ir/shiraz/dentistry | grep -o 'مراکز .* در شیراز' | head -1"
