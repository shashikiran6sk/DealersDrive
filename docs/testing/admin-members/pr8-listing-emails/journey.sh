#!/bin/bash
# PR8 manual journey against the local dev stack (console mail driver, jobs on).
set -euo pipefail
source /tmp/env.sh
cd /home/user/DealersDrive
set -a; source .env; set +a
API=http://localhost:4000
D="dd_session=$(cat /tmp/dealer-token)"
O="dd_session=$(cat /tmp/ops-token)"
S="dd_session=$(cat /tmp/sales-token)"
PLATE="${1:-KA 05 MR 8801}"
J='Content-Type: application/json'
step() { echo; echo "=== $*"; }
call() { local cookie=$1 method=$2 path=$3 body=${4:-}; curl -s -X "$method" -b "$cookie" -H "$J" ${body:+-d "$body"} "$API$path"; }
wait_mail() { sleep 5; }

if [ -z "${RESUME_VID:-}" ]; then
step "1. Dealer creates and submits $PLATE"
VID=$(call "$D" POST /v1/dealer/vehicles "{\"registrationNumber\":\"$PLATE\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
call "$D" PATCH /v1/dealer/vehicles/$VID '{"make":"Hyundai","model":"Creta","variant":"SX(O)","manufacturingYear":2023,"registrationYear":2023,"fuelType":"PETROL","transmission":"AUTOMATIC","bodyType":"SUV","kilometersDriven":22400,"ownerCount":1,"color":"WHITE","insuranceType":"COMPREHENSIVE","insuranceValidUntil":"2027-03-31","pricePaise":145000000,"negotiability":"FIXED","description":"Single owner."}' >/dev/null
LID=$(call "$D" POST /v1/dealer/vehicles/$VID/submit | python3 -c 'import sys,json;print(json.load(sys.stdin)["listing"]["id"])')
echo "vehicle=$VID listing=$LID"
wait_mail

step "2. Operations (priya, MODERATOR) requests changes"
call "$O" POST /v1/admin/listings/$LID/request-changes '{"reason":"Add a photo of the odometer."}' >/dev/null
wait_mail

step "3. Dealer resubmits"
call "$D" POST /v1/dealer/vehicles/$VID/submit >/dev/null
wait_mail

else VID=$RESUME_VID; LID=$RESUME_LID; fi

step "4. Photos seeded (local only), checks ticked, approved"
(cd apps/api && pnpm exec tsx -e "
import { createPrisma } from './src/platform/db/prisma.ts';
import { seedImages } from './tests/images-kit.ts';
(async () => {
  const p = createPrisma();
  await seedImages(p, { vehicleId: '$VID', dealerId: 'f7966789-4c78-4410-9d47-6f8b1278b652' }, 6);
  await p.\$disconnect();
})();
" )
for key in $(cd packages/contracts && node -e "import('./dist/index.js').then(m=>console.log(m.ListingCheckKey.options.join(' ')))" 2>/dev/null); do
  call "$O" PUT /v1/admin/listings/$LID/checks/$key '{"checked":true}' >/dev/null
done
call "$O" POST /v1/admin/listings/$LID/approve '{}' | python3 -c 'import sys,json;d=json.load(sys.stdin);print("status:",d.get("status") or d.get("code"))'
wait_mail

step "5. Dealer reserves, then asks for reactivation"
call "$D" POST /v1/dealer/vehicles/$VID/reserve '{}' >/dev/null
call "$D" POST /v1/dealer/vehicles/$VID/request-reactivation '{"reason":"The buyer backed out."}' >/dev/null
wait_mail
RID=$(psql "$DATABASE_URL" -At -c "select r.id from listing_reactivation_requests r where r.\"listingId\"='$LID' and r.status='PENDING'")

step "6. Operations approves the reactivation"
call "$O" POST /v1/admin/reactivation-requests/$RID/approve '{}' >/dev/null
wait_mail

step "7. Dealer marks it sold (expect no email)"
SOLD_AT=$(date -u +%Y-%m-%dT%H:%M:%S)
call "$D" POST /v1/dealer/vehicles/$VID/mark-sold '{}' >/dev/null
wait_mail

step "Deliveries for this listing's dealership + admin listing mail since start"
psql "$DATABASE_URL" -c "select template, recipient, status, attempts, \"createdAt\"::time(0) from notification_deliveries where \"createdAt\" > now() - interval '10 minutes' and template like '%listing%' order by \"createdAt\";"
psql "$DATABASE_URL" -At -c "select 'deliveries after mark-sold: ' || count(*) from notification_deliveries where \"createdAt\" >= '$SOLD_AT' and template like '%listing%';"
echo "LID=$LID VID=$VID"
