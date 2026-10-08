# PR #283 — dashboard and custom-domain evidence

PR: https://github.com/shashikiran6sk/DealersDrive/pull/283
Head: `6e1779d2d09e86335716237f9b4e62c3e9cb7530`.
Base: PR #282 at `497e7a5247ae6a5da1d04004641cceb1b4ce70fd`.

Final full local suite passed: API 3,111 tests / 159 files, web 1,482 / 123,
contracts 511 / 16, shared UI 17, storefront 8. API coverage: 97.04% lines,
90.35% branches, 95.97% statements, 97.67% functions. No gates lowered.
Lint/format/docs, typecheck, build, Prisma schema validation/generation,
frozen-lockfile installation and critical dependency audit passed. Unchanged
6 high / 6 moderate advisories remain reported by dependency audit.

Custom-domain integration exercises the real authenticated API/database with
two independent synthetic dealerships and an injected provider: concurrent
reservation, global collision, IDOR, owner/manager/staff, proof-before-attach,
provider-specific records, delayed verification/TLS, primary selection,
ownership loss/fallback, provider failure/conflict, removal-pending/retry,
tombstones, fresh proof on re-add, reservation limits and expiry/sweep.
Provider unit cases exercise supported REST URLs, identity checks, actual DNS
recommendations, missing credentials, conflicts, malformed responses and
timeouts. DNS/TLS unit tests verify exact TXT, pinned public IPv4, private/mixed
DNS rejection and certificate validation/failure. The final full log includes
the added delayed-provider-challenge regression beyond the earlier focused log.

Dashboard tests cover real action payloads, consent/identity boundaries,
pending/error feedback, read-only state, private image references/removal,
URL copying and accessible mobile More navigation. Build verifies the real
My Website and protected preview routes. No browser screenshot review is
claimed: automatic approval review's usage limit blocked further browser
actions. The actual campaign Light screenshot is under PR #282.

Real Vercel project credentials, DNS ownership/routing, wildcard certificates
and live TLS integration are unavailable/unverified. No live provider write,
production database migration, DNS change, merge or production deployment.
Qualified legal review and PR #279 reconciliation remain prerequisites.

GitHub checks are pending until final-head logs/status are added. Verified
OPEN, unmerged, correctly stacked and with no auto-merge request.
