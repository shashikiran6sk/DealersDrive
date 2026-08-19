#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Bring the whole product up in containers, in the one order that works.
#
#   pnpm app:up              start everything
#   pnpm app:up --seed       ...and rebuild the demo data first (TRUNCATES)
#
# Why this is a script and not `docker compose --profile app up -d --build`:
# Compose builds every image before it starts anything, and the web image
# cannot be built until the API is answering. The public marketplace pages are
# ISR, so `next build` prerenders them, and prerendering them calls the API.
# Same constraint deploy/release.sh documents for the host deployment.
# ---------------------------------------------------------------------------
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SEED=false
[[ "${1:-}" == "--seed" ]] && SEED=true

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

log "Backing services, migrations, API"
docker compose --profile app up -d --build api

if $SEED; then
  log "Seeding demo data (this truncates the database)"
  docker compose run --rm seed
fi

log "Waiting for the API"
for i in $(seq 1 45); do
  if curl -fsS -o /dev/null http://127.0.0.1:4000/health/ready; then break; fi
  [[ $i -eq 45 ]] && { echo "API never became ready — docker compose logs api"; exit 1; }
  sleep 2
done
curl -fsS http://127.0.0.1:4000/health/ready && echo

# The web build prerenders against the API, so it goes after the wait, not
# before it.
log "Building and starting the web app"
docker compose --profile app up -d --build web

log "Up. http://localhost:3000 — API on http://localhost:4000/api/docs"
docker compose --profile app ps
