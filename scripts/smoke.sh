#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Smoke test — the last step of every deploy, for both environments.
#
#   ./scripts/smoke.sh <web-base-url> <api-base-url> <sha>
#
# A green deployment means the containers passed their health check and Vercel
# accepted a build. It does not mean the site works. This asks the public URLs
# the questions a person would, and one a health check structurally cannot:
# *is the build that is serving the build we just deployed?* Both tiers answer
# 200 whether they are running the new commit or the old one, so without the
# version comparison a deploy that silently did nothing looks like a success.
#
# `<api-base-url>` may be empty. While the API tier is not yet deployed
# (`AWS_DEPLOY_ENABLED` unset) the web app ships on its own, and asking
# questions of a host that does not exist would fail every deploy for a reason
# that is not a fault.
#
# A freshly-deployed URL is not instantly consistent — DNS, an alias being
# swapped, a Fargate task still draining — so each check retries rather than
# judging the deploy on one unlucky request.
# ---------------------------------------------------------------------------
set -euo pipefail

WEB_BASE_URL="${1:-}"
API_BASE_URL="${2:-}"
EXPECTED_SHA="${3:-}"

ATTEMPTS=10
DELAY=6

if [ -z "$WEB_BASE_URL" ]; then
  echo "usage: smoke.sh <web-base-url> <api-base-url|''> <sha>" >&2
  exit 2
fi

fail() {
  echo "::error::$1" >&2
  exit 1
}

# Fetches a URL until it answers 2xx, and prints the body. Everything here is
# a GET of a public endpoint, so retrying is safe by construction.
fetch() {
  local url="$1" attempt=1 body
  while [ "$attempt" -le "$ATTEMPTS" ]; do
    if body=$(curl -fsS --max-time 15 "$url" 2>/dev/null); then
      printf '%s' "$body"
      return 0
    fi
    echo "  … $url did not answer (attempt $attempt/$ATTEMPTS)" >&2
    attempt=$((attempt + 1))
    sleep "$DELAY"
  done
  return 1
}

# The version check is skipped, loudly, rather than failed when a tier reports
# `unknown`: that is the honest value for a build that was not given a SHA, and
# treating it as a mismatch would block a deploy over missing metadata rather
# than over a broken site.
check_version() {
  local tier="$1" reported="$2"
  if [ -z "$EXPECTED_SHA" ]; then
    return 0
  fi
  if [ "$reported" = "unknown" ] || [ "$reported" = "null" ] || [ -z "$reported" ]; then
    echo "::warning::$tier does not report a commit (version=${reported:-empty}); cannot confirm the new build is serving."
    return 0
  fi
  if [ "$reported" != "$EXPECTED_SHA" ]; then
    fail "$tier is serving $reported, not the $EXPECTED_SHA that was just deployed. The rollout did not take."
  fi
  echo "  ✓ $tier is serving $reported"
}

echo "Smoke testing $WEB_BASE_URL"

# 1. The site answers at all. A 200 on the root is the cheapest proof that
#    something is rendering rather than that a process is alive.
fetch "$WEB_BASE_URL/" > /dev/null || fail "$WEB_BASE_URL/ never answered."
echo "  ✓ the site renders"

# 2. …and it is the build we just shipped.
WEB_HEALTH=$(fetch "$WEB_BASE_URL/api/health") || fail "$WEB_BASE_URL/api/health never answered."
WEB_STATUS=$(echo "$WEB_HEALTH" | jq -r '.status')
[ "$WEB_STATUS" = "ok" ] || fail "web /api/health reports status=$WEB_STATUS."
check_version "web" "$(echo "$WEB_HEALTH" | jq -r '.version')"

if [ -z "$API_BASE_URL" ]; then
  echo "::notice::No API base URL given — the API tier is not deployed in this environment. Skipping its checks."
  echo "Smoke test passed (web only)."
  exit 0
fi

echo "Smoke testing $API_BASE_URL"

# 3. The API is live and, separately, ready. `/health/live` never fails during
#    a drain and `/health/ready` 503s the instant SIGTERM arrives, so the two
#    answer different questions and both are worth asking.
fetch "$API_BASE_URL/health/live" > /dev/null || fail "$API_BASE_URL/health/live never answered."
echo "  ✓ the API is live"

API_READY=$(fetch "$API_BASE_URL/health/ready") || fail "$API_BASE_URL/health/ready never answered 2xx."
API_STATUS=$(echo "$API_READY" | jq -r '.status')
[ "$API_STATUS" = "ok" ] || fail "api /health/ready reports status=$API_STATUS: $(echo "$API_READY" | jq -c '.checks')"
check_version "api" "$(echo "$API_READY" | jq -r '.version')"

# 4. The two tiers agree. They deploy from one job but to two platforms, and a
#    half-applied deploy is exactly the state that looks fine tier by tier.
WEB_SHA=$(echo "$WEB_HEALTH" | jq -r '.version')
API_SHA=$(echo "$API_READY" | jq -r '.version')
if [ "$WEB_SHA" != "unknown" ] && [ "$API_SHA" != "unknown" ] && [ "$WEB_SHA" != "$API_SHA" ]; then
  fail "the tiers disagree: web is serving $WEB_SHA, the API $API_SHA."
fi

echo "Smoke test passed."
