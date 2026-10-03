#!/usr/bin/env bash
set -euo pipefail

app_env="${APP_ENV:-}"
if [[ -z "$app_env" && -f .env ]]; then
  app_env="$(sed -n 's/^APP_ENV=//p' .env | tail -n 1 | tr -d '\r')"
fi
app_env="${app_env:-local}"
export HOST_UID="$(id -u)"
export HOST_GID="$(id -g)"
case "$app_env" in
  local)
    docker compose --profile development stop worker-development 2>/dev/null || true
    APP_ENV=local S3_ENDPOINT=http://minio:9000 docker compose --profile local up -d --build postgres minio mailpit migrate worker
    pnpm --filter @dealers-drive/api db:seed:local-auth
    ;;
  development)
    docker compose --profile local stop worker minio 2>/dev/null || true
    APP_ENV=development docker compose --profile development up -d --build postgres mailpit migrate worker-development
    ;;
  *)
    echo "infra:up supports APP_ENV=local or APP_ENV=development" >&2
    exit 1
    ;;
esac
