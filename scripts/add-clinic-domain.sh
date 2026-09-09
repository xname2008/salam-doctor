#!/usr/bin/env bash
# ==========================================================================
# add-clinic-domain.sh — provision a dedicated clinic website (domain).
#
# Automates the "dedicated site" architecture:
#   1. Obtain a Let's Encrypt certificate (webroot / ACME) for the domain.
#   2. Render deploy/clinic-sites.d/<domain>.conf from the server template.
#   3. Validate (nginx -t) and hot-reload the web container.
#
# The domain's ACME challenge is answered by the HTTP catch-all in nginx.conf
# (serves /var/www/certbot for ANY host), so this works before the dedicated
# block exists. Point the domain's DNS at this server first.
#
# Usage (from project root):
#   bash scripts/add-clinic-domain.sh <domain> [upstream] [email]
#
#   <domain>    e.g. dr-nahal.ir
#   [upstream]  host:port to proxy to.  Default: backend:3000  (shared backend)
#               Use clinic_<slug>:3000 to target an ISOLATED clinic container
#               (see docker-compose.clinics.yml).
#   [email]     Let's Encrypt account email. Default: $CERTBOT_EMAIL
#
# Examples:
#   bash scripts/add-clinic-domain.sh dr-nahal.ir
#   bash scripts/add-clinic-domain.sh dr-nahal.ir clinic_nahal:3000 admin@salam-doctor.ir
# ==========================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

DOMAIN="${1:-}"
UPSTREAM="${2:-backend:3000}"
EMAIL="${3:-${CERTBOT_EMAIL:-}}"

if [[ -z "$DOMAIN" ]]; then
  echo "ERROR: domain is required." >&2
  echo "Usage: bash scripts/add-clinic-domain.sh <domain> [upstream] [email]" >&2
  exit 1
fi

# Basic hostname sanity check (letters/digits/hyphens/dots).
if ! [[ "$DOMAIN" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$ ]]; then
  echo "ERROR: '$DOMAIN' is not a valid domain name." >&2
  exit 1
fi

if [[ -z "$EMAIL" ]]; then
  echo "ERROR: no Let's Encrypt email. Pass as 3rd arg or set CERTBOT_EMAIL." >&2
  exit 1
fi

CONF_DIR="deploy/clinic-sites.d"
CONF_FILE="${CONF_DIR}/${DOMAIN}.conf"
TEMPLATE="deploy/clinic-site.conf.template"
mkdir -p "$CONF_DIR"

echo "==> [1/3] Requesting Let's Encrypt certificate for ${DOMAIN} ..."
# Idempotent: certbot skips issuance if a valid cert already exists.
docker compose run --rm --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" --agree-tos --no-eff-email --non-interactive

echo "==> [2/3] Rendering ${CONF_FILE} (upstream: ${UPSTREAM}) ..."
sed -e "s|__CLINIC_DOMAIN__|${DOMAIN}|g" \
    -e "s|__CLINIC_UPSTREAM__|${UPSTREAM}|g" \
    "$TEMPLATE" > "$CONF_FILE"

echo "    Reminder: for a topical backlink, add a line to the \$clinic_backlink_html"
echo "    map in nginx.conf for '${DOMAIN}' (defaults to /shiraz/beauty otherwise)."

echo "==> [3/3] Validating and reloading nginx ..."
docker compose exec web nginx -t
docker compose exec web nginx -s reload

echo "Done. https://${DOMAIN} is live and proxied to ${UPSTREAM}."
echo "Verify:"
echo "  curl -sI https://${DOMAIN} | head -5"
echo "  curl -s  https://${DOMAIN} | grep -o 'salam-doctor.ir/shiraz/[a-z-]*'   # backlink present"
