#!/usr/bin/env bash
set -euo pipefail

# Nightly cron (production server) — use bash so chmod is not required:
#   30 3 * * * bash /home/xname2008/Documents/nginx/html/backup-db.sh >> /home/xname2008/Documents/nginx/html/backups/backup.log 2>&1
#
# If cron says "permission denied", install as root instead:
#   sudo crontab -e
#   30 3 * * * su - xname2008 -c 'bash /home/xname2008/Documents/nginx/html/backup-db.sh >> /home/xname2008/Documents/nginx/html/backups/backup.log 2>&1'
#
# If docker says "permission denied", either add your user to the docker group:
#   sudo usermod -aG docker xname2008   # then log out and back in
# or force sudo in cron:
#   DOCKER_COMPOSE="sudo docker compose" bash backup-db.sh
#
# docker-compose mounts ./leads.db as a single file (not the whole /app dir), so the
# consistent snapshot is copied out with `docker compose cp`, not a host-side path.

# --- Config ---
# Script lives in the project root; override PROJECT_DIR if deployed elsewhere.
PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
DB_FILE="$PROJECT_DIR/leads.db"
BACKUP_DIR="$PROJECT_DIR/backups"
RETENTION_DAYS=30
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUP_DIR/leads-$TIMESTAMP.db"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"
SERVICE="backend"
# Written inside the container (not on the host mount — leads.db is a single-file bind).
TMP_IN_CONTAINER="/tmp/leads-backup-$TIMESTAMP.db"

# Use sudo when the current user cannot access the Docker socket.
if [[ -z "${DOCKER_COMPOSE:-}" ]]; then
  if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE=(docker compose)
  elif sudo docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE=(sudo docker compose)
  else
    DOCKER_COMPOSE=(docker compose)
  fi
else
  # shellcheck disable=SC2206
  DOCKER_COMPOSE=($DOCKER_COMPOSE)
fi

mkdir -p "$BACKUP_DIR"

if [[ ! -f "$DB_FILE" ]]; then
  echo "ERROR: Database not found at $DB_FILE" >&2
  echo "Run this script from the project root (where leads.db and docker-compose.yml live)." >&2
  exit 1
fi

backup_with_vacuum_into() {
  "${DOCKER_COMPOSE[@]}" -f "$COMPOSE_FILE" exec -T "$SERVICE" node -e "
const D = require('better-sqlite3');
const db = new D('/app/leads.db');
db.exec(\"VACUUM INTO '${TMP_IN_CONTAINER}'\");
db.close();
"
}

copy_snapshot_from_container() {
  "${DOCKER_COMPOSE[@]}" -f "$COMPOSE_FILE" cp "$SERVICE:$TMP_IN_CONTAINER" "$DEST"
  "${DOCKER_COMPOSE[@]}" -f "$COMPOSE_FILE" exec -T "$SERVICE" rm -f "$TMP_IN_CONTAINER"
}

backup_with_local_vacuum() {
  # Fallback when docker is unavailable (dev host): same engine as the app.
  node -e "
const path = require('path');
const D = require('better-sqlite3');
const dbPath = path.join(process.cwd(), 'leads.db');
const dest = process.argv[1].replace(/'/g, \"''\");
const db = new D(dbPath);
db.exec(\"VACUUM INTO '\" + dest + \"'\");
db.close();
" "$DEST"
}

if command -v docker >/dev/null 2>&1 \
   && "${DOCKER_COMPOSE[@]}" -f "$COMPOSE_FILE" ps -q "$SERVICE" 2>/dev/null | grep -q .; then
  if backup_with_vacuum_into; then
    copy_snapshot_from_container
  else
    echo "VACUUM INTO failed inside container, falling back to file copy" >&2
    cp "$DB_FILE" "$DEST"
  fi
elif command -v node >/dev/null 2>&1 && [[ -f "$PROJECT_DIR/package.json" ]]; then
  echo "Docker backend not running — using local node VACUUM INTO" >&2
  (cd "$PROJECT_DIR" && backup_with_local_vacuum)
else
  echo "VACUUM INTO unavailable, falling back to file copy" >&2
  cp "$DB_FILE" "$DEST"
fi

gzip -f "$DEST"

find "$BACKUP_DIR" -name 'leads-*.db.gz' -mtime +"$RETENTION_DAYS" -delete

echo "Backup complete: $DEST.gz"
