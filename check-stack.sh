#!/bin/sh
set -e

echo "=== Salam Doctor stack check ==="
echo ""

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not found"
  exit 1
fi

echo "1) Container status"
docker compose ps
echo ""

echo "2) Nginx config test"
docker compose exec web nginx -t
echo ""

echo "3) Backend health (inside backend container)"
docker compose exec backend node -e "fetch('http://127.0.0.1:3000/api/health').then(async r=>console.log(r.status, await r.text())).catch(e=>{console.error(e);process.exit(1)})"
echo ""

echo "4) API via nginx (host port 80)"
curl -sf http://localhost/api/health && echo "" || { echo "FAIL: /api/health unreachable via nginx"; exit 1; }

echo "5) Leads API via nginx"
curl -sf http://localhost/api/leads | head -c 200 && echo "" || { echo "FAIL: /api/leads unreachable via nginx"; exit 1; }

echo "5b) Reports API (needs backend rebuild if 404)"
REPORTS_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/admin/reports/summary)
echo "GET /api/admin/reports/summary -> HTTP $REPORTS_CODE"
if [ "$REPORTS_CODE" = "404" ]; then
  echo "WARN: reports endpoints missing — run: docker compose build backend && docker compose up -d"
fi

echo "6) Socket.io client (local asset)"
curl -sfI http://localhost/assets/js/socket.io.min.js | head -n 1 || { echo "FAIL: local socket.io asset missing"; exit 1; }

echo "7) Socket.io endpoint via nginx"
curl -sfI "http://localhost/socket.io/?EIO=4&transport=polling" | head -n 1 || { echo "FAIL: /socket.io/ not proxied to backend"; exit 1; }

echo "8) Admin htpasswd mount"
docker compose exec web test -r /etc/nginx/certs/.htpasswd && echo "OK: .htpasswd readable" || echo "WARN: .htpasswd missing inside web container"

echo ""
echo "All checks passed."
