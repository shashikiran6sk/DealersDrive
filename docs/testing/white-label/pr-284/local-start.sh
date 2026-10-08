#!/bin/sh
set -eu
cd /Users/shashikiran/Development/dealers-drive
set -a
. /private/tmp/dealers-drive-white-label-local.env
set +a
case "${1:-}" in
 api) exec pnpm --filter @dealers-drive/api exec tsx src/index.ts ;;
 web) exec pnpm --filter @dealers-drive/web exec next dev --port 3300 ;;
 storefront) export STOREFRONT_DEV_HOSTNAME="${2:-qa-alpha.dealers-drive.com}"; exec pnpm --filter @dealers-drive/storefront exec next dev --port 3302 ;;
 *) printf '%s\n' 'Usage: sh /private/tmp/dealers-drive-white-label-local-start.sh api|web|storefront [hostname]' >&2; exit 2 ;;
esac
