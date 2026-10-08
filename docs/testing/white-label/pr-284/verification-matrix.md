# White-label V1 security and verification matrix

The implementation uses one shared API/database/inventory, one shared storefront
app, exactly two presentation themes and the authenticated dashboard control plane.
This review retains every existing certification test and unchanged quality gate.
Execution logs and screenshots live on `testing_branch` under PR numbers.

## Confirmed findings and fixes

| Finding                                                                                                          | Severity        | Remediation and regression                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Queued website writes could outlive a member/session change if authorization were checked only at the HTTP guard | High            | Existing locked transaction authorization is reused after the per-dealer lock; observed PostgreSQL lock-wait test revokes the owner and proves no theme mutation commits.                                                                                                                     |
| Customer enquiry authorization could become stale while waiting on a listing lock                                | High            | Storefront enquiry transaction rechecks/locks user identity, proved phone, role seats and current session before creating a lead. Observed queued-session revocation test proves 401 and unchanged enquiry count. Marketplace behavior remains compatible.                                    |
| Publication changes left stale marketplace navigation in saved/enquiry views                                     | Medium          | Availability and public hrefs now honor marketplace destination; hidden images are removed from saved cards. HTTP journey and mapper tests verify website-only/neither behavior.                                                                                                              |
| Arbitrary host/forwarded-host, global detail or similar queries could cross tenants                              | High, prevented | Server-only hostname assertion; globally registered verified mappings, current website/dealer eligibility, scoped rows/counts/vocabulary/detail/related inventory, fixed-origin redirects. Two-dealer adversarial tests cover spoofing and IDOR.                                              |
| HTML streaming could obscure inactive-tenant 404 status                                                          | Medium          | Pre-stream middleware resolves the tenant, returns noindex 404 for unknown/inactive and 503 for infrastructure failure; typed response and registered primary origin are checked before continuing.                                                                                           |
| Domain squatting/takeover or stale ownership                                                                     | High, prevented | Unique tenant-bound retained reservations, capped pending domains, fresh TXT before attach/re-add, refuse pre-existing deployments, provider/routing/TLS readiness, hourly renewal and 24-hour fail-closed expiry.                                                                            |
| DNS/TLS probe SSRF or disabled certificate checks                                                                | High, prevented | Public IPv4 validation, reject mixed/private/reserved DNS, pinned IP and validated servername certificate, bounded DNS/socket/API deadlines. Dedicated failure/timeout tests.                                                                                                                 |
| Pending provider verification could hide necessary TXT instructions                                              | Medium          | Retain provider challenge on a pending verification response; no activation occurs. Regression verifies actual challenge remains visible.                                                                                                                                                     |
| Unbounded/malicious branding or media                                                                            | High, prevented | Strict bounded plain text/URLs/IDs, role/membership checks, MIME/byte/pixel caps, metadata stripping, safe owned derivatives and protected preview. Vehicle queries explicitly require admin-uploaded VEHICLE media. Stale unassociated uploads are cleaned without deleting retained assets. |
| Cross-tenant caching or cached suspension                                                                        | High, prevented | Dynamic/no-store HTML/API, request-only memoization, current eligibility on media/ETag delivery, no fallback tenant. Sold/disabled/suspended and tenant-switch tests verify current state.                                                                                                    |
| Sensitive write rate limiter unavailable                                                                         | Medium          | New sensitive writes fail closed on counter storage failure and share existing customer/IP enquiry buckets. Existing unrelated API policy remains unchanged.                                                                                                                                  |

No confirmed critical/high application finding remains unmitigated in the new
feature after the regression fixes. Existing dependency audit reports six high
and six moderate advisories; these are not represented as eliminated. Critical
audit, Semgrep and Gitleaks remain mandatory. Legal/provider/visual rollout gates
remain external verification requirements.

Dependency review: the six high findings are PostCSS source-map file reads
(two advisories), Prisma config deepmerge recursion, Prisma CLI MySQL authentication,
ESLint glob braces recursion and source-map-js offset exhaustion. These are
existing compiler/configuration/CLI chains, not dealer-editable CSS, arbitrary
configuration objects, MySQL connections or untrusted lint/source maps in this
feature. The API uses PostgreSQL; branding does not accept CSS or source maps.
Moderate findings also include the existing Express qs parser and resolver/tooling
chains. No global transitive-major override was introduced without compatibility
validation; owners must review/update these dependencies before a production
security sign-off. The full machine-readable audit is on the evidence branch.

## Required matrix and evidence source

| Categories                                                                                   | Executed coverage                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–6 activation, concurrency, slug, collision, reserved names, transitions                    | Foundation contract/database tests and real API races; idempotent DRAFT→pending→verified ACTIVE and disable/reactivation.                                                                                                                                                                                                                                           |
| 7–10 suspension, closure, revocation, roles                                                  | Cookie and transactional guards; OWNER/MANAGER/STAFF; admin suspend/reinstate; queued owner revocation and expired sessions.                                                                                                                                                                                                                                        |
| 11–14 branding, Light, Dark, persistence                                                     | Strict contracts, real image processing/storage tests, both-theme component behavior/keyboard/contrast, saved Light→Dark API journey.                                                                                                                                                                                                                               |
| 15–20 host resolution, unknown, verified/unverified domains, reassignment, primary redirects | API two-tenant isolation, provider lifecycle mocks, retained tombstone/re-add proof, pre-stream and fixed-origin redirect tests.                                                                                                                                                                                                                                    |
| 21–28 inventory, channels, moderation, RESERVED/SOLD/WITHDRAWN, listing URLs, private media  | Full create/submit/upload/check/approve/reserve/sold HTTP journey; moderation state matrix, website-only/neither, KYC/media ownership and revocation tests; existing withdrawn/reactivation regressions retained.                                                                                                                                                   |
| 29–34 enquiries, ownership, OTP, consent, limits, freshness                                  | Actual cookie/phone flow on deterministic OTP driver, server-bound origin/identity, explicit consent record, shared duplicate/rate-limit guard, admin/dealer inbox/outbox, queued session revocation and authoritative sold-form rejection.                                                                                                                         |
| 35 SEO                                                                                       | Per-tenant titles/canonicals/structured-data escaping, no fabricated facts, production/noindex policy, sitemap tenant scope and pagination, robots/unknown/failure behavior.                                                                                                                                                                                        |
| 36–37 mobile/accessibility                                                                   | Shared UI semantic labels/keyboard/dialog/reserved/empty/image-failure tests and accent contrast across 4,096 colors. Actual final Light/Dark home, inventory, details, dashboard and enquiry form: all six widths, no overflow. Gallery Escape/focus, protected preview and theme persistence reviewed in the browser. Three final screenshots are outside source. |
| 38–39 API/database/storage/provider failures                                                 | Client network/malformed/503 tests, public failure propagation, limiter storage failure, ownership/certificate failure, provider conflict/timeout/removal, image decoder/storage/fallback and cleanup retry tests. No live production dependency was stopped.                                                                                                       |
| 40 deployment                                                                                | Full monorepo builds, three additive migration preservation rehearsals, frozen lockfile, Terraform CI and documented ordered owner rollout/rollback. Actual live infrastructure smoke tests are unverified.                                                                                                                                                         |

The complete HTTP journey uses real application routes, cookies, isolated
PostgreSQL and local storage; Google/OTP/provider boundaries are deterministic
test ports. Vehicle photos are uploaded through the existing admin presign/PUT/
commit API before moderation approval. Dealer fixtures use existing tested
onboarding plus synthetic approved status; this is not represented as a new live
KYC certification. The tests also retain existing dealer approval/OTP/regression
suites. Local browser journeys passed for dashboard theme persistence, preview,
custom-domain reservation/removal, disable/reactivation, both themes and the
customer fake-OTP/signup/consent/enquiry-to-dealer-inbox flow. Dealer authentication
uses the existing local development resolver; no SMS is sent. Production/staging
E2E with real identity, owned DNS and certificates remains unverified. A disabled
site returned the tested fail-closed response, which Chrome displayed as a blocked
page during local review; no browser warning was bypassed.

## Performance and limits

The hardening suite reads a 320-car tenant in bounded 24-row pages repeatedly,
reports local p50/p95 and proves a second tenant cannot affect results or filter
vocabulary. The public query performs fixed bulk reads/counts, not per-card
queries. Domain resolution uses unique hostname and dealer indexes; storefront
inventory has a partial publication index. Images use existing responsive widths
and lazy loading with dimensions; hero images are prioritized.

Local measurements are advisory and recorded outside source. Production SSR,
mobile Lighthouse/Web Vitals, network/image delivery and actual SQL statement
counts need staging measurement. V1 trades cache hit rate for prompt revocation;
there is no shared data cache whose hit rate can be honestly benchmarked. The
pre-stream tenant guard adds one uncached resolution call per document request.
Do not claim a local benchmark establishes a production latency SLO.

V2 excludes subscriptions/metering, analytics, additional themes, section builders,
promotions and automatic ownership transfer. Individually provisioned default
subdomains need per-host readiness automation; the V1 default readiness flag
attests a fully verified wildcard only. Custom domains remain available as the
safe alternative when wildcard DNS cannot be configured without disrupting
existing infrastructure.
