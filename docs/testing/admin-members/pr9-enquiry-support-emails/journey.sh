#!/bin/bash
# PR9 manual journey against the local dev stack (console mail driver, jobs on).
set -euo pipefail
source /tmp/env.sh
cd /home/user/DealersDrive
set -a; source .env; set +a
API=http://localhost:4000
D="dd_session=$(cat /tmp/dealer-token)"
O="dd_session=$(cat /tmp/ops-token)"
J='Content-Type: application/json'
RUN=$(date +%s)
JAR=$(mktemp -d)
step() { echo; echo "=== $*"; }
call() { local cookie=$1 method=$2 path=$3 body=${4:-}; curl -s -X "$method" -b "$cookie" -H "$J" ${body:+-d "$body"} "$API$path"; }
jcall() { local jar=$1 method=$2 path=$3 body=${4:-}; curl -s -X "$method" -b "$jar" -c "$jar" -H "$J" ${body:+-d "$body"} "$API$path"; }
py() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)"; }
T0=$(date -u +%Y-%m-%dT%H:%M:%S)

step "0. Put a car live (dealer submits, photos seeded locally, Operations approves)"
VID=$(call "$D" POST /v1/dealer/vehicles "{\"registrationNumber\":\"KA 05 MR ${RUN: -4}\"}" | py 'd["id"]')
call "$D" PATCH /v1/dealer/vehicles/$VID '{"make":"Tata","model":"Nexon","variant":"XZ+","manufacturingYear":2022,"registrationYear":2022,"fuelType":"PETROL","transmission":"MANUAL","bodyType":"SUV","kilometersDriven":18000,"ownerCount":1,"color":"BLUE","insuranceType":"COMPREHENSIVE","insuranceValidUntil":"2027-05-31","pricePaise":89500000,"negotiability":"SLIGHTLY","description":"Single owner."}' >/dev/null
LID=$(call "$D" POST /v1/dealer/vehicles/$VID/submit | py 'd["listing"]["id"]')
(cd apps/api && pnpm exec tsx -e "
import { createPrisma } from './src/platform/db/prisma.ts';
import { seedImages } from './tests/images-kit.ts';
(async () => { const p = createPrisma(); await seedImages(p, { vehicleId: '$VID', dealerId: 'f7966789-4c78-4410-9d47-6f8b1278b652' }, 6); await p.\$disconnect(); })();
")
for key in REGISTRATION MAKE_MODEL VARIANT YEAR ODOMETER OWNERSHIP PRICING; do call "$O" PUT /v1/admin/listings/$LID/checks/$key '{"checked":true}' >/dev/null; done
call "$O" POST /v1/admin/listings/$LID/approve '{}' >/dev/null
SLUG=$(psql "$DATABASE_URL" -At -c "select slug from listings where id='$LID'")
echo "live: /car/$SLUG"

signup() {
  local jar=$1 phone=$2 name=$3
  local token
  token=$(jcall "$jar" POST /v1/auth/sign-in/phone/customer "{\"phone\":\"$phone\",\"accessToken\":\"dev-otp:91$phone:$PHONE_OTP_DEV_CODE:r117-$RUN-$phone\"}" | py 'd["signUpToken"]')
  jcall "$jar" POST /v1/auth/sign-up/customer "{\"signUpToken\":\"$token\",\"fullName\":\"$name\"}" | py 'd["customer"]["id"]'
}

step "1. Two customers sign up by phone; Asha's email is verified (local only), Ravi's is not"
ASHA_PHONE="94${RUN: -8}"; RAVI_PHONE="93${RUN: -8}"
ASHA=$(signup "$JAR/asha" "$ASHA_PHONE" "Asha Menon")
RAVI=$(signup "$JAR/ravi" "$RAVI_PHONE" "Ravi Kumar")
psql "$DATABASE_URL" -q -c "update users set email='asha.menon@customers.test', \"emailVerifiedAt\"=now() where id='$ASHA'"
echo "asha=$ASHA ravi=$RAVI"

step "2. Asha enquires about the car"
jcall "$JAR/asha" POST /v1/enquiries "{\"listingSlug\":\"$SLUG\",\"message\":\"Is the price negotiable? Can I see it on Saturday?\"}" | py '"enquiry", d.get("id") or d'
sleep 5

step "3. Asha raises a support request"
T=$(jcall "$JAR/asha" POST /v1/support/tickets '{"category":"DEALER_ISSUE","subject":"Dealer has not confirmed my visit","description":"I asked about Saturday and have not heard back yet. My alternate number is in my profile."}')
TID=$(echo "$T" | py 'd["id"]'); REF=$(echo "$T" | py 'd["reference"]'); echo "ticket $REF ($TID)"
sleep 5

step "4. Ravi (no verified email) raises one"
R=$(jcall "$JAR/ravi" POST /v1/support/tickets '{"category":"ACCOUNT_ISSUE","subject":"Cannot update my name","description":"The profile page will not save my new surname for some reason."}')
echo "ticket $(echo "$R" | py 'd["reference"]')"
sleep 5

step "5. priya (MODERATOR) moves Asha's request: waiting for customer, priority high"
call "$O" PATCH /v1/admin/support/tickets/$TID '{"status":"WAITING_FOR_CUSTOMER"}' >/dev/null
call "$O" PATCH /v1/admin/support/tickets/$TID '{"priority":"HIGH"}' >/dev/null
sleep 5

step "6. Asha replies (reopens to in progress — no email); priya resolves it"
jcall "$JAR/asha" POST /v1/support/tickets/$TID/messages '{"message":"The dealer has now called me, thank you."}' >/dev/null
sleep 3
call "$O" PATCH /v1/admin/support/tickets/$TID '{"status":"RESOLVED"}' >/dev/null
sleep 6

step "Deliveries since start (enquiry + support templates)"
psql "$DATABASE_URL" -c "select template, recipient, status, attempts, \"dealerId\" is null as no_dealer, subject from notification_deliveries where \"createdAt\" >= '$T0' and (template like '%enquiry%' or template like '%support%') order by \"createdAt\";"
echo "phone leak check (dealer email body is in API log):"
grep -c "$ASHA_PHONE" /tmp/pr9-api.log || true
rm -rf "$JAR"
echo "TID=$TID REF=$REF LID=$LID SLUG=$SLUG"
