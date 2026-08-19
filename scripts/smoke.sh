#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Smoke test — is the deployment that just finished actually serving?
#
#   scripts/smoke.sh <web-base-url> <api-base-url> [expected-sha]
#
#   scripts/smoke.sh http://localhost:3000 http://localhost:4000
#   scripts/smoke.sh https://dev.dealers-drive.com https://dev.dealers-drive.com/api 9f2c…
#
# A green ECS deployment means the containers answered their health check. It
# does not mean the site works, and it does not mean the *new* containers are
# the ones answering. This asks the public URLs the questions a person would,
# and — given an expected SHA — refuses to pass unless the build that is
# serving is the build that was just deployed.
#
# Deliberately read-only. It signs nobody in, writes no row and uploads no
# photo: a smoke test that mutates production is a smoke test nobody dares run
# when they most need to. The write paths are covered by the integration suite
# in CI, against a real database, before any of this.
#
# Exit codes: 0 every check passed · 1 a check failed (the failure is named).
# ---------------------------------------------------------------------------
set -uo pipefail

WEB_BASE_URL="${1:-}"
API_BASE_URL="${2:-}"
EXPECTED_SHA="${3:-}"

if [[ -z "$WEB_BASE_URL" || -z "$API_BASE_URL" ]]; then
  echo "usage: $0 <web-base-url> <api-base-url> [expected-sha]" >&2
  exit 2
fi

command -v jq >/dev/null || { echo "smoke: jq is required" >&2; exit 2; }

# Enough for a cold Fargate task to answer, not so long that a hung deploy
# takes fifteen minutes to admit it.
CURL=(curl --silent --show-error --location --max-time 20 --retry 3 --retry-delay 3 --retry-connrefused)

PASS=0
FAIL=0

pass() { printf '  \033[0;32m✓\033[0m %s\n' "$1"; PASS=$((PASS + 1)); }
fail() { printf '  \033[0;31m✗\033[0m %s\n     %s\n' "$1" "${2:-}"; FAIL=$((FAIL + 1)); }
group() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# Fetches a URL and holds the body in $BODY and the status in $STATUS.
fetch() {
  local url="$1"
  local response
  response=$("${CURL[@]}" --write-out '\n%{http_code}' "$url" 2>/dev/null)
  STATUS="${response##*$'\n'}"
  BODY="${response%$'\n'*}"
}

expect_status() {
  local url="$1" want="$2" label="$3"
  fetch "$url"
  if [[ "$STATUS" == "$want" ]]; then
    pass "$label"
  else
    fail "$label" "$url answered $STATUS, expected $want"
  fi
}

# ── the API ────────────────────────────────────────────────────────────────
group "API — $API_BASE_URL"

# Liveness touches no dependency; readiness names the one that is down. Both
# matter here: a 503 from /ready with a body is a diagnosis, not a mystery.
expect_status "$API_BASE_URL/health/live" 200 "liveness"

fetch "$API_BASE_URL/health/ready"
if [[ "$STATUS" != "200" ]]; then
  fail "readiness" "answered $STATUS: $(echo "$BODY" | head -c 400)"
else
  READY_STATUS=$(echo "$BODY" | jq -r '.status // "?"')
  DOWN=$(echo "$BODY" | jq -r '.checks | to_entries | map(select(.value != "ok") | .key) | join(", ")' 2>/dev/null)
  if [[ "$READY_STATUS" == "ok" ]]; then
    pass "readiness — every dependency answered"
  else
    fail "readiness" "status=$READY_STATUS, down: ${DOWN:-unknown}"
  fi

  API_SHA=$(echo "$BODY" | jq -r '.version // "unknown"')
  API_ENV=$(echo "$BODY" | jq -r '.appEnv // "unknown"')
  if [[ -n "$EXPECTED_SHA" ]]; then
    if [[ "$API_SHA" == "$EXPECTED_SHA" ]]; then
      pass "API is running the deployed build (${API_SHA:0:12})"
    else
      # The most valuable check in the file. Everything can be green while the
      # previous task definition is still serving every request.
      fail "API build" "serving ${API_SHA:0:12}, expected ${EXPECTED_SHA:0:12} — the old tasks are still taking traffic"
    fi
  else
    pass "API build ${API_SHA:0:12} (appEnv=$API_ENV)"
  fi
fi

# The public marketplace read path, which is the one thing that must never be
# down: it is what a buyer sees.
fetch "$API_BASE_URL/v1/vehicles?limit=1"
if [[ "$STATUS" == "200" ]] && echo "$BODY" | jq -e '.data | type == "array"' >/dev/null 2>&1; then
  pass "GET /v1/vehicles returns a list"
else
  fail "GET /v1/vehicles" "answered $STATUS: $(echo "$BODY" | head -c 200)"
fi

# Sign-in is reachable and knows whether Google is configured. A deployment
# with no OAuth credentials starts perfectly and then cannot sign anybody in.
fetch "$API_BASE_URL/v1/auth/providers"
if [[ "$STATUS" == "200" ]]; then
  if [[ "$(echo "$BODY" | jq -r '.google.enabled')" == "true" ]]; then
    pass "dealer sign-in is configured"
  else
    fail "dealer sign-in" "google.enabled is false — GOOGLE_CLIENT_ID/SECRET are missing in this environment"
  fi
else
  fail "GET /v1/auth/providers" "answered $STATUS"
fi

# An unauthenticated request to a dealer route must be refused. This is a
# smoke test, not an authorization test — but a deployment that lost its guard
# middleware should never reach a person.
fetch "$API_BASE_URL/v1/dealer/vehicles"
if [[ "$STATUS" == "401" ]]; then
  pass "dealer routes reject an anonymous request"
else
  fail "dealer route guard" "GET /v1/dealer/vehicles answered $STATUS, expected 401"
fi

# ── the web app ────────────────────────────────────────────────────────────
group "Web — $WEB_BASE_URL"

fetch "$WEB_BASE_URL/api/health"
if [[ "$STATUS" != "200" ]]; then
  fail "web health" "answered $STATUS"
  APP_ENV="unknown"
else
  APP_ENV=$(echo "$BODY" | jq -r '.appEnv // "unknown"')
  WEB_SHA=$(echo "$BODY" | jq -r '.version // "unknown"')
  if [[ -n "$EXPECTED_SHA" && "$WEB_SHA" != "$EXPECTED_SHA" ]]; then
    fail "web build" "serving ${WEB_SHA:0:12}, expected ${EXPECTED_SHA:0:12}"
  else
    pass "web is running the deployed build (${WEB_SHA:0:12}, appEnv=$APP_ENV)"
  fi
fi

expect_status "$WEB_BASE_URL/" 200 "home page renders"
expect_status "$WEB_BASE_URL/cars" 200 "search page renders"
expect_status "$WEB_BASE_URL/dealers" 200 "dealer directory renders"
expect_status "$WEB_BASE_URL/dealer/login" 200 "dealer sign-in renders"

# The home page is server-rendered from the API. A 200 containing an error
# shell would pass the status check and fail every buyer.
fetch "$WEB_BASE_URL/"
if echo "$BODY" | grep -qi 'dealers-drive'; then
  pass "home page carries real markup"
else
  fail "home page content" "200, but the response does not look like the marketplace"
fi

# robots.txt is environment-dependent — and it is the check that would have
# caught a production image built with no APP_ENV shipping `Disallow: /`.
fetch "$WEB_BASE_URL/robots.txt"
if [[ "$APP_ENV" == "production" ]]; then
  if echo "$BODY" | grep -qiE '^Allow: /$'; then
    pass "robots.txt allows crawling in production"
  else
    fail "robots.txt" "production is not allowing crawlers: $(echo "$BODY" | head -c 120)"
  fi
else
  if echo "$BODY" | grep -qiE '^Disallow: /$'; then
    pass "robots.txt keeps $APP_ENV out of search results"
  else
    fail "robots.txt" "$APP_ENV is crawlable — it will compete with production in search"
  fi
fi

# ── how it is served ───────────────────────────────────────────────────────
group "Transport"

if [[ "$WEB_BASE_URL" == https://* ]]; then
  # Session cookies carry `Secure` in production; over plain HTTP sign-in
  # appears to succeed and the browser throws the cookie away.
  pass "web is served over HTTPS"

  HEADERS=$(curl -sSI --max-time 20 "$WEB_BASE_URL/" 2>/dev/null)
  if echo "$HEADERS" | grep -qi '^x-powered-by:'; then
    fail "x-powered-by" "the header is still being sent"
  else
    pass "no x-powered-by header"
  fi
else
  pass "local target, HTTPS checks skipped"
fi

# ── verdict ────────────────────────────────────────────────────────────────
printf '\n%s\n' "─────────────────────────────────────────"
if [[ "$FAIL" -eq 0 ]]; then
  printf '\033[0;32msmoke: %d checks passed\033[0m\n' "$PASS"
  exit 0
fi
printf '\033[0;31msmoke: %d failed, %d passed\033[0m\n' "$FAIL" "$PASS"
exit 1
