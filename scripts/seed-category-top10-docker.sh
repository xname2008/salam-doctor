#!/usr/bin/env bash
# Seed Top 10 category clinics (Nahal #1 + samples).
# Fixes "module not found" by mounting scripts into Docker (they are not in the image).
#
# Usage from project root on the server:
#   bash scripts/seed-category-top10-docker.sh
set -euo pipefail
cd "$(dirname "$0")/.."

SQL_FILE="scripts/seed-category-top10.sql"
APPLY_JS="scripts/apply-category-top10-sql.js"

for f in "$SQL_FILE" "$APPLY_JS" leads.db; do
  if [[ ! -f "$f" ]]; then
    echo "Missing $f — upload it to the server project root first."
    exit 1
  fi
done

echo "Stopping backend (avoids DB lock)..."
docker compose stop backend 2>/dev/null || true
rm -f leads.db-wal leads.db-shm

if command -v sqlite3 >/dev/null 2>&1; then
  echo "Seeding with host sqlite3 (no Node modules needed)..."
  sqlite3 leads.db < "$SQL_FILE"
  sqlite3 leads.db "SELECT category_id, COUNT(*) AS n FROM category_top_clinics GROUP BY category_id ORDER BY category_id;"
else
  echo "Seeding inside Docker (mounts scripts; uses image better-sqlite3)..."
  docker compose run --rm --no-deps \
    -v "$(pwd)/leads.db:/app/leads.db" \
    -v "$(pwd)/$SQL_FILE:/app/scripts/seed-category-top10.sql:ro" \
    -v "$(pwd)/$APPLY_JS:/app/scripts/apply-category-top10-sql.js:ro" \
    backend node scripts/apply-category-top10-sql.js
fi

echo "Starting backend..."
docker compose up -d backend

echo "Done. Verify:"
echo "  curl -s http://127.0.0.1:3000/api/categories/hair/top5"
