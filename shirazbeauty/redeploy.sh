#!/usr/bin/env bash
# Rebuild and restart the Shiraz Beauty stack after a code change.
# The frontend is a production build, so changes are only visible on
# https://shirazbeauty.ir once this has run (~40s).
#
#   ./redeploy.sh          rebuild everything
#   ./redeploy.sh web      rebuild only the frontend
#   ./redeploy.sh api      rebuild only the backend

set -euo pipefail

cd "$(dirname "$0")"

PROJECT=shirazbeauty
PROXY=salam-doctor-web
SERVICE="${1:-}"

if [ -n "$SERVICE" ]; then
    docker compose -p "$PROJECT" up -d --build "$SERVICE"
else
    docker compose -p "$PROJECT" up -d --build
fi

# Recreated containers get new IPs, but nginx resolved the upstream hostnames
# once at startup and caches them — without this reload the site 502s.
echo
echo "Reloading nginx so it re-resolves the upstreams..."
if docker exec "$PROXY" nginx -t >/dev/null 2>&1; then
    docker exec "$PROXY" nginx -s reload
else
    echo "WARNING: $PROXY failed its config test; skipping reload." >&2
fi

echo
echo "Waiting for the site to answer..."
for _ in $(seq 1 30); do
    if curl -fsk -o /dev/null https://shirazbeauty.ir; then
        echo "https://shirazbeauty.ir is up."
        exit 0
    fi
    sleep 2
done

echo "Site did not respond in 60s. Check: docker compose -p $PROJECT logs web" >&2
exit 1
