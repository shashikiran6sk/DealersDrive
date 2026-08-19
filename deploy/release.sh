#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Build and (re)start the app on the server.
#
#   bash ~/dealers-drive/deploy/release.sh            # build + migrate + restart
#   bash ~/dealers-drive/deploy/release.sh --seed     # ...and reseed demo data
#
# --seed TRUNCATES every application table and rewrites the demo dealerships,
# vehicles, photos and admin account. That is what you want before a demo and
# never what you want after someone has clicked around in one.
#
# The step order no longer *has* to be this one: the web build is offline now
# (every data-reading route is `force-dynamic`, so `next build` calls nothing).
# It stays this way because it is still the right order to *start* things in —
# the API should be migrated and answering before the site in front of it is
# restarted — and because the readiness wait below is worth keeping.
# ---------------------------------------------------------------------------
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

SEED=false
[[ "${1:-}" == "--seed" ]] && SEED=true

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

[[ -f .env ]] || { echo "No .env at $REPO — copy deploy/env.production.example first."; exit 1; }

log "Data services"
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d
docker compose -f deploy/docker-compose.prod.yml --env-file .env ps

log "Dependencies"
pnpm install --frozen-lockfile

log "Prisma client"
pnpm --filter @dealers-drive/api db:generate

log "Build: contracts + api"
NODE_ENV=production pnpm --filter @dealers-drive/api... build

log "Migrations"
pnpm --filter @dealers-drive/api db:migrate:deploy

if $SEED; then
  log "Seeding demo data (this truncates the database)"
  pnpm --filter @dealers-drive/api db:seed
fi

log "Start the API"
sudo systemctl restart dealers-drive-api

# The web build prerenders against this, so wait for it rather than racing it.
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:4000/health/ready; then break; fi
  [[ $i -eq 30 ]] && { echo "API did not become ready — journalctl -u dealers-drive-api -n 50"; exit 1; }
  sleep 2
done
curl -fsS http://127.0.0.1:4000/health/ready && echo

log "Build: web"
NODE_ENV=production pnpm --filter @dealers-drive/web build

log "Start the web app"
sudo systemctl restart dealers-drive-web
sleep 3
sudo systemctl --no-pager --lines=0 status dealers-drive-api dealers-drive-web || true
curl -fsS -o /dev/null -w 'web: %{http_code}\n' http://127.0.0.1:3000/

log "Released."
