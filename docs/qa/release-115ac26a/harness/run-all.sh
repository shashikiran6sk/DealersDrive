#!/usr/bin/env bash
# Replays the whole campaign in a fixed order against the services named in run-env.sh
# (see ../TEST-EXECUTION-GUIDE.md), then runs finalize.mjs. Disposable local data only.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
logs="${CERT_LOG_DIR:-$here/../.run-logs}"
mkdir -p "$logs"
order=(
  c01-priority c02-public c03-auth-customer-saved c04-enquiry c05-onboard-verify
  c06-member-identity-rbac c08-admin-dealerlife-cross c09-cross-search-data
  c10-security c11-notify-recovery-obs c12-prod-deploy
  d01-delta d03-console-suspension d05-msg91-faults s01-stored-xss
  retest-232-adjacent retest-233-race retest-234-pagination retest-235-media
  retest-237-prodenv retest-findings retest-new012-enquiry-race retest-campaign
  c07-listing b01-public-seo b02-browser-ux b03-golden u01-agent-uat u02-touch-history u03-gallery u04-recovery
  d02-stale-suspension d04-backup-restore
  n01-contact-calls n02-contact-browser n03-enquiry-digest n04-legal-gate
)
for name in "${order[@]}"; do
  start=$(date -u +%T)
  timeout 2400 node "$here/$name.mjs" > "$logs/$name.log" 2>&1
  code=$?
  echo "$name exit=$code start=$start end=$(date -u +%T) pass=$(grep -c '✓' "$logs/$name.log") fail=$(grep -c '✗' "$logs/$name.log") other=$(grep -c '^·' "$logs/$name.log")"
done
# The release-candidate retest supersedes the hand-written baseline analysis records (zz-*).
timeout 2400 node "$here/v01-final-retest.mjs" > "$logs/v01-final-retest.log" 2>&1
echo "v01-final-retest exit=$? pass=$(grep -c '✓' "$logs/v01-final-retest.log") fail=$(grep -c '✗' "$logs/v01-final-retest.log")"
node "$here/finalize.mjs"
