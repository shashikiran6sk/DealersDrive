#!/usr/bin/env bash
# Rebuilds the promotional demo in a local database: the demo rows, the
# placeholder photography, and the attachment of one to the other.
# Assumes `db:seed` and `db:seed:dev` have already been run.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
repo="$(cd "$here/../.." && pwd)"

echo "1/3  demo rows and catalogue"
(cd "$repo" && pnpm --filter @dealers-drive/api db:seed:promo --catalog-only)

echo "2/3  placeholder photography"
(cd "$here" && node scripts/generate-media.mjs "$@")

echo "3/3  attaching photographs"
(cd "$repo" && pnpm --filter @dealers-drive/api db:seed:promo)
