#!/bin/bash
# PR10 manual journey against the local dev stack (SMS_DRIVER=console, jobs on).
set -euo pipefail
source /tmp/env.sh
cd /home/user/DealersDrive
set -a; source .env; set +a
API=http://localhost:4000
O="dd_session=$(cat /tmp/ops-token)"
J='Content-Type: application/json'
RUN=$(date +%s)
JAR=$(mktemp -d)
step() { echo; echo "=== $*"; }
jcall() { local jar=$1 method=$2 path=$3 body=${4:-}; curl -s -X "$method" -b "$jar" -c "$jar" -H "$J" ${body:+-d "$body"} "$API$path"; }
py() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)"; }
T0=$(date -u +%Y-%m-%dT%H:%M:%S)

step "1. A phone-only customer signs up (no email at all)"
PHONE="92${RUN: -8}"
TOKEN=$(jcall "$JAR/c" POST /v1/auth/sign-in/phone/customer "{\"phone\":\"$PHONE\",\"accessToken\":\"dev-otp:91$PHONE:$PHONE_OTP_DEV_CODE:r118-$RUN\"}" | py 'd["signUpToken"]')
jcall "$JAR/c" POST /v1/auth/sign-up/customer "{\"signUpToken\":\"$TOKEN\",\"fullName\":\"Meena Raj\"}" | py '"customer", d["customer"]["id"]'

step "2. They raise a support request"
T=$(jcall "$JAR/c" POST /v1/support/tickets '{"category":"TECHNICAL_ISSUE","subject":"Photos do not load on my phone","description":"The car photos stay blank on my phone browser since yesterday evening."}')
TID=$(echo "$T" | py 'd["id"]'); REF=$(echo "$T" | py 'd["reference"]'); echo "ticket $REF"
sleep 6

step "3. Support moves it (expect no second SMS)"
curl -s -o /dev/null -X PATCH -b "$O" -H "$J" -d '{"status":"IN_PROGRESS"}' "$API/v1/admin/support/tickets/$TID"
sleep 6

step "Deliveries for this ticket"
psql "$DATABASE_URL" -c "select channel, template, regexp_replace(recipient, '[0-9](?=[0-9]{4})', '•', 'g') as recipient, subject, status, attempts, \"dealerId\" is null as no_dealer from notification_deliveries where \"createdAt\" >= '$T0' order by \"createdAt\";"

step "Console SMS driver log line (number masked)"
grep '"channel":"sms"' /tmp/pr10-api.log | grep "$REF" | python3 -c '
import sys, json
for line in sys.stdin:
    d = json.loads(line)
    print({k: d[k] for k in ("msg","driver","to","tag","templateId","variables") if k in d})'
echo "full number in API log: $(grep -c "$PHONE" /tmp/pr10-api.log || true) occurrence(s)"
rm -rf "$JAR"
echo "REF=$REF TID=$TID"
