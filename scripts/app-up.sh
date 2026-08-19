#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Bring the whole product up in containers.
#
#   pnpm app:up              start everything
#   pnpm app:up --seed       ...and rebuild the demo data first (TRUNCATES)
#
# This used to be a two-phase script, because the web image could not be built
# until the API was answering. It no longer is: every data-reading route is
# `force-dynamic`, so `next build` calls nothing and compose can build and
# start the whole profile in one pass. What is left here is the readiness wait
# and the optional seed — the two things `docker compose up` cannot express.
# ---------------------------------------------------------------------------
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SEED=false
[[ "${1:-}" == "--seed" ]] && SEED=true

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

log "Building and starting everything"
docker compose --profile app up -d --build

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

log "Waiting for the web app"
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:3000/api/health; then break; fi
  [[ $i -eq 30 ]] && { echo "Web never became ready — docker compose logs web"; exit 1; }
  sleep 2
done

log "Up. http://localhost:3000 — API on http://localhost:4000/api/docs"
docker compose --profile app ps
