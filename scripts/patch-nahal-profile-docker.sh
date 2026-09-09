#!/usr/bin/env bash
# Patch Nahal clinic intro (id=114) via Docker — avoids Mac node_modules on Linux host.
set -euo pipefail
cd "$(dirname "$0")/.."

docker compose stop backend 2>/dev/null || true
rm -f leads.db-wal leads.db-shm

docker compose run --rm --no-deps \
  -v "$(pwd)/scripts/patch-nahal-profile.js:/app/scripts/patch-nahal-profile.js:ro" \
  -v "$(pwd)/scripts/nahal-profile-intro.html:/app/scripts/nahal-profile-intro.html:ro" \
  -v "$(pwd)/clinic-intros:/app/clinic-intros" \
  backend node scripts/patch-nahal-profile.js

docker compose up -d backend
echo "Done. Check: curl -s 'https://salam-doctor.ir/api/clinic-profile?clinic_id=114' | head -c 200"
