#!/usr/bin/env bash
set -euo pipefail

# Copy compressed DB backups to another drive or machine.
#
# IMPORTANT: Run from the project root (where backups/ lives), or set PROJECT_DIR:
#   PROJECT_DIR=/home/xname2008/Documents/nginx/html \
#     REMOTE=/path/to/usb bash backup-offsite.sh
#
# USB (must be mounted and writable by you):
#   PROJECT_DIR=/home/xname2008/Documents/nginx/html \
#     REMOTE=/media/xname2008/MYUSB/salam-doctor-backups bash backup-offsite.sh
#
# SSH (needs key-based login to backupuser@host):
#   PROJECT_DIR=/home/xname2008/Documents/nginx/html \
#     REMOTE=backupuser@192.168.1.50:/backups/salam-doctor bash backup-offsite.sh
#
# Weekly cron example:
#   0 4 * * 0 PROJECT_DIR=/home/xname2008/Documents/nginx/html REMOTE=/media/xname2008/MYUSB/salam-doctor-backups bash /home/xname2008/Documents/nginx/html/backup-offsite.sh >> /home/xname2008/Documents/nginx/html/backups/offsite.log 2>&1

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
BACKUP_DIR="$PROJECT_DIR/backups"
REMOTE="${REMOTE:-}"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

if [[ -z "$REMOTE" ]]; then
  die "Set REMOTE first.

Examples:
  PROJECT_DIR=$PROJECT_DIR REMOTE=\$HOME/salam-doctor-backups bash backup-offsite.sh
  PROJECT_DIR=$PROJECT_DIR REMOTE=/media/\$USER/MYUSB/salam-doctor-backups bash backup-offsite.sh
  PROJECT_DIR=$PROJECT_DIR REMOTE=backupuser@192.168.1.50:/backups/salam-doctor bash backup-offsite.sh"
fi

if [[ ! -d "$BACKUP_DIR" ]]; then
  die "Backup folder not found: $BACKUP_DIR
Run backup-db.sh first, or set PROJECT_DIR to your site root (where leads.db lives)."
fi

if ! compgen -G "$BACKUP_DIR/leads-*.db.gz" >/dev/null; then
  die "No backups in $BACKUP_DIR — run: bash $PROJECT_DIR/backup-db.sh"
fi

# --- Local folder (USB drive, second disk, home folder) ---
if [[ "$REMOTE" != *@*:* ]]; then
  # Expand ~ and variables in local paths
  REMOTE="${REMOTE/#\~/$HOME}"

  if [[ ! -e "$REMOTE" ]]; then
    if ! mkdir -p "$REMOTE" 2>/dev/null; then
      die "Cannot create $REMOTE (permission denied or parent not mounted).
For USB: plug in the drive, find the mount point with:
  lsblk -o NAME,SIZE,LABEL,MOUNTPOINT
  # or on macOS: ls /Volumes/
Then set REMOTE to that path, e.g. REMOTE=/Volumes/MYUSB/salam-doctor-backups"
    fi
  fi

  if [[ ! -d "$REMOTE" ]]; then
    die "$REMOTE exists but is not a directory"
  fi

  if [[ ! -w "$REMOTE" ]]; then
    die "$REMOTE is not writable by $(whoami).
Try: sudo chown -R \$(whoami) \"$REMOTE\"
Or pick a folder you own, e.g. REMOTE=\$HOME/salam-doctor-backups"
  fi

  rsync -av --delete "$BACKUP_DIR/" "$REMOTE/"
  echo "Offsite copy complete: $BACKUP_DIR -> $REMOTE"
  exit 0
fi

# --- SSH / rsync remote ---
if ! command -v rsync >/dev/null 2>&1; then
  die "rsync is not installed"
fi

HOST="${REMOTE%%:*}"
DEST_PATH="${REMOTE#*:}"

if [[ -z "$HOST" || -z "$DEST_PATH" || "$DEST_PATH" == "$REMOTE" ]]; then
  die "Invalid REMOTE format. Use: user@host:/absolute/path"
fi

echo "Testing SSH to $HOST ..."
if ! ssh -o BatchMode=yes -o ConnectTimeout=10 "$HOST" "test -d '$DEST_PATH' || mkdir -p '$DEST_PATH'" 2>/dev/null; then
  die "SSH to $HOST failed (permission denied or host unreachable).

Fix checklist:
  1. Can you log in?   ssh $HOST
  2. Set up a key:     ssh-copy-id $HOST
  3. Remote writable? ssh $HOST \"mkdir -p '$DEST_PATH' && touch '$DEST_PATH/.write-test' && rm '$DEST_PATH/.write-test'\"
  4. Use full path:   REMOTE=user@host:/home/backupuser/backups/salam-doctor"
fi

rsync -av --delete -e ssh "$BACKUP_DIR/" "$REMOTE/"
echo "Offsite copy complete: $BACKUP_DIR -> $REMOTE"
