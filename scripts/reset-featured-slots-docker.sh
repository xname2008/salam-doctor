#!/usr/bin/env bash
# Reset top-5 featured clinics using the backend container (Linux better-sqlite3).
# Usage from project root: bash scripts/reset-featured-slots-docker.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Stopping backend (avoids DB lock)..."
docker compose stop backend 2>/dev/null || true
rm -f leads.db-wal leads.db-shm

echo "Resetting featured slots inside Docker..."
docker compose run --rm --no-deps \
  -v "$(pwd)/scripts/reset-featured-slots.js:/app/scripts/reset-featured-slots.js:ro" \
  backend node scripts/reset-featured-slots.js

echo "Starting backend..."
docker compose up -d backend

echo "Done. Verify with:"
echo "  curl -s https://salam-doctor.ir/api/featured | python3 -m json.tool"
