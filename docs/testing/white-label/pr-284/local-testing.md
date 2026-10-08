# Local white-label testing

Feature code: feat/white-label-05-hardening. Node 24; pnpm 9.15.9.
The synthetic QA database and storage used during delivery remain on the current
workstation. The local launcher uses ports 4300 (API), 3300 (central web) and
3302 (shared storefront), with Alpha as the development dashboard owner. It
preserves the repository .env. The settings enable only local fake-domain
readiness and the existing fake OTP/console mail/local storage drivers.

## Current workstation

The prepared files are /private/tmp/dealers-drive-white-label-local.env and
/private/tmp/dealers-drive-white-label-local-start.sh. Open three terminals:

```sh
sh /private/tmp/dealers-drive-white-label-local-start.sh api
```

```sh
sh /private/tmp/dealers-drive-white-label-local-start.sh web
```

```sh
sh /private/tmp/dealers-drive-white-label-local-start.sh storefront
```

Open http://localhost:3300/dealer/website and http://localhost:3302.
Use Ctrl+C in each terminal to stop. Startup/readiness with background jobs,
local storage, database and cache was verified after preparing this launcher.

## Recreate after temporary files disappear

Run from the repository root with the final feature branch checked out and a
clean/preserved working tree. The launcher contains the current workstation's
repository path; change that cd if cloning elsewhere. This uses the existing
Docker PostgreSQL defaults on localhost:5432, including CREATEDB permission.

```sh
pnpm install --frozen-lockfile
pnpm --filter @dealers-drive/api db:generate
pnpm --filter @dealers-drive/contracts build
docker compose up -d postgres
git fetch origin testing_branch
git show origin/testing_branch:docs/testing/white-label/pr-284/local.env.example > /private/tmp/dealers-drive-white-label-local.env
git show origin/testing_branch:docs/testing/white-label/pr-284/local-start.sh > /private/tmp/dealers-drive-white-label-local-start.sh
git show origin/testing_branch:docs/testing/white-label/pr-282/qa-seed.mjs > /private/tmp/dd-white-label-qa-seed.mjs
node /private/tmp/dd-white-label-qa-seed.mjs "$PWD" create-only
DATABASE_URL=postgresql://dealersdrive:dealersdrive@localhost:5432/dealersdrive_white_label_qa pnpm --filter @dealers-drive/api db:migrate:deploy
node /private/tmp/dd-white-label-qa-seed.mjs "$PWD"
```

The seed creates/updates synthetic Alpha/Beta sites and owned images, without
resetting the QA database or existing enquiry/lifecycle edits. It does not
restore cars subsequently marked SOLD. Only the named QA database is migrated;
no production connection is used. All fixture names and photos are labelled test
content. After setup, use the three terminals above.

## Manual journey

1. Alpha dashboard My Website: change headline/branding and save; preview;
   switch Light/Dark, save and reload the public localhost site.
2. Search/filter inventory, open a vehicle and exercise its fullscreen gallery.
   RESERVED cards have no detail/enquiry action.
3. Enquire about an ACTIVE vehicle. The central web handoff has the existing
   customer phone flow. Use a synthetic number and fake OTP 123456; no SMS is
   sent. Complete the name, consent and enquiry, then check
   http://localhost:3300/dealer/enquiries for Dealer website source.
4. Disable the site, confirm it becomes unavailable, then explicitly activate
   it in My Website. Actual HTTP fail-closed behavior is covered by tests;
   Chrome displayed ERR_BLOCKED_BY_CLIENT for the local plain inactive response.
5. Add a synthetic example.com subdomain, inspect the ownership TXT and remove.
   Provider is disabled locally, so this is not a real verified/TLS domain.
   Full success/failure/provider paths are exercised by deterministic tests.
6. Stop the storefront terminal and start it again for Beta:

```sh
sh /private/tmp/dealers-drive-white-label-local-start.sh storefront qa-beta.dealers-drive.com
```

Beta shows Kia stock/Dark branding; Alpha shows Honda stock. Dashboard still
manages Alpha. Canonical/Open website/return links use registered QA hostnames;
use localhost:3302 for browsing since no real DNS maps those hostnames locally.

## Automated checks

Run from the repository root. The suite uses isolated test databases, separate
from the manual QA database. Run only one integration test process at a time.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Focused storefront boundary coverage can run in one API invocation:

```sh
pnpm --filter @dealers-drive/api exec vitest run tests/storefront-foundation.test.ts tests/storefront-migration.test.ts tests/storefront-api.test.ts tests/storefront-domains.test.ts tests/storefront-hardening.test.ts
```

Do not run Next production builds concurrently with Next dev for the same app;
both write its .next directory. Stop the dev terminals before building.
Real OAuth/SMS/Vercel DNS/TLS and production performance remain staging gates.
