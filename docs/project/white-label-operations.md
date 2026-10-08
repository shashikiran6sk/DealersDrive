# White-label V1 operations and controlled rollout

This is a review-ready code stack, not permission to merge or deploy. All five
feature PRs must remain open. No production migration, deployment, provider
mutation, purchase or DNS change is part of the implementation campaign.

## Prerequisites and configuration ownership

- Repository owner: review the entire stack, branch topology and exact-head CI.
  Resolve the existing dependency audit's high/moderate advisories under the
  established repository policy; critical advisories remain blocking.
- Product/legal owner: review the actual service-provider attribution and
  enquiry disclosure, and reconcile the feature with open legal/privacy PR
  #279. Do not treat informational website pages as a reviewed legal policy.
- Hosting owner: create **one shared storefront project per environment**, not
  per dealership. Keep the marketplace project and existing URLs independent.
- DNS owner: inventory and preserve apex/www/API/admin/mail/MX/TXT/SPF/DKIM/DMARC
  records before any delegation. No live DNS modification is authorized here.
- Security owner: issue dedicated least-privilege server credentials and verify
  that none are exposed through browser variables, logs or build output.
- QA owner: complete staging journeys with real authentication, OTP and owned DNS,
  including all six responsive widths, gallery keyboard/focus, theme persistence,
  protected preview, domains and customer enquiry-to-inbox. Local execution logs,
  screenshots and verification matrix belong only to the PR-numbered evidence
  directories on `testing_branch`, outside feature PRs. Development adapters do
  not establish live authentication/provider certification.

## Shared Vercel project

Use the existing GitHub monorepo, Node 24 and pnpm 9.15.9. Root directory:
`apps/storefront`. Enable access to files outside that root for workspace
packages. Install from the repository root with `pnpm install --frozen-lockfile`.
Build from the repository root with the existing Turbo graph filtered to
`@dealers-drive/storefront...`, or build contracts first and run the storefront
package build. Select the Next.js framework preset; output is the framework's
`.next`, not a static export. `apps/storefront/vercel.json` selects Mumbai
`bom1` and disables automatic Git deployment. Configure a separate controlled
deployment workflow/project binding after human review. The existing marketplace
Vercel workflow is unchanged and does not deploy this new project.

The shared Express/database/worker infrastructure stays in its existing Mumbai
AWS region (`ap-south-1`). Verify HTTPS connectivity and measured latency from
storefront functions to the API. Do not create another backend/database or put
database credentials on Vercel. Private storage remains behind the existing API.

| Variable                                                    | API/worker                   | Storefront                   | Marketplace web             | Policy                                                                       |
| ----------------------------------------------------------- | ---------------------------- | ---------------------------- | --------------------------- | ---------------------------------------------------------------------------- |
| STOREFRONT_ENABLED                                          | required opt-in              | —                            | —                           | Defaults false. Enable only after staging verification.                      |
| STOREFRONT_DEFAULT_DOMAIN_READY                             | operational attestation      | —                            | —                           | Defaults false. True only for verified wildcard routing/TLS.                 |
| STOREFRONT_ROOT_HOSTNAME                                    | platform base host           | —                            | —                           | Default dealers-drive.com; normalized and deployment-owned.                  |
| STOREFRONT_SERVICE_SECRET                                   | secret                       | same secret                  | —                           | At least 32 random characters; never NEXT_PUBLIC.                            |
| API_BASE_URL                                                | existing API origin          | shared HTTPS API             | existing shared HTTPS API   | Server-only; production must not point to loopback.                          |
| WEB_BASE_URL                                                | central marketplace origin   | central marketplace origin   | existing marketplace origin | Required for verified-customer handoff.                                      |
| APP_ENV                                                     | existing environment         | production/dev/preview/local | existing environment        | Storefront indexing only when production.                                    |
| CLIENT_IP_FORWARD_SECRET                                    | existing secret              | same secret                  | existing secret             | Trusted proxy IP attestation; verify edge headers are overwritten by Vercel. |
| STOREFRONT_DOMAIN_PROVIDER                                  | disabled/vercel              | —                            | —                           | Disabled until provider configured. No production mock driver.               |
| STOREFRONT_VERCEL_TOKEN                                     | secret                       | —                            | —                           | Dedicated project/team-scoped provider access where supported.               |
| STOREFRONT_VERCEL_PROJECT_ID                                | dedicated storefront project | —                            | —                           | Use the shared storefront, never marketplace project.                        |
| STOREFRONT_VERCEL_TEAM_ID                                   | dedicated team binding       | —                            | —                           | Required with Vercel provider.                                               |
| DATABASE_URL / storage / mail / OTP / cache / observability | existing settings            | —                            | existing web settings only  | No new parallel infrastructure; preserve production-safe drivers.            |

`STOREFRONT_DEV_HOSTNAME` is optional only for local development on localhost.
Production ignores it. There is no tenant query parameter or public preview
token. Do not use a shared Domain session cookie across arbitrary dealer sites.

## Default subdomains, DNS and certificates

For `<slug>.dealers-drive.com`, attach `*.dealers-drive.com` to the one shared
storefront project. Current [Vercel wildcard documentation](https://vercel.com/docs/domains/working-with-domains/add-a-domain#using-wildcard-domain)
supports either Vercel nameservers or external-DNS certificate-challenge delegation.
Prefer retaining the existing DNS provider when the owner verifies compatibility:

1. Add the wildcard in the dedicated storefront project's Domains settings.
2. Enable Vercel DNS for the team's base-domain entry, retaining existing registrar
   nameservers. Inventory all existing certificate-challenge users first.
3. Following the provider's current instructions, delegate `_acme-challenge`
   within the `dealers-drive.com` zone with NS records for `ns1.vercel-dns.com.`
   and `ns2.vercel-dns.com.`. These delegate certificate validation, not traffic.
   This can conflict with another provider using the same challenge name; owner
   review is required before any change.
4. Add wildcard traffic routing using the actual storefront project's recommended
   CNAME. Current documentation shows `*` → `cname.vercel-dns-0.com.`; confirm the
   actual recommendation instead of treating this example as deployed evidence.
5. Verify DNS propagation, project configuration, issued certificate and renewal
   before setting default readiness. Keep challenge delegation in place.

Exact apex/www/API/admin/mail and MX/TXT/SPF/DKIM/DMARC records must continue
serving their existing systems. If choosing full nameserver delegation instead,
copy and verify every existing record before changing registrar nameservers.
No DNS change or external configuration was performed in this campaign.

If wildcard delegation conflicts with live DNS, **leave default readiness false**.
The supported V1 alternative is an ownership-verified custom domain on the shared
project. Individual default-host provisioning would need additional per-host
readiness automation; a global readiness flag must not pretend individually
configured names cover future reservations. Do not enable the global flag for
that partial alternative. The owner may approve a future per-host provider flow.

Custom-domain records shown by the dashboard are the fresh platform ownership
TXT and actual provider-returned verification/routing recommendations. Dealer DNS
changes happen outside the dashboard. Both provider configuration and a valid
hostname certificate handshake must pass before ACTIVE. Apex domains use the
provider's recommended A address; subdomains use its recommended CNAME where
available. No provider assignment is moved automatically.

Keep the exact ownership TXT in DNS while the domain is used. Hourly worker
checks refresh ACTIVE custom domains after 12 hours and retry removals. Public
eligibility expires after 24 hours without a successful check. Re-add rotates
proof. Removed reservations stay with the original tenant; ownership transfer
requires an audited support procedure outside V1, not client reassignment.

## Ordered deployment checklist — owner execution only

1. Review all five final heads and required checks, migration rehearsals,
   security fixes, disclosure/legal decisions and unresolved visual evidence.
   No verdict grants merge/deployment approval.
2. Create an isolated staging database restore. Rehearse all three additive migrations,
   preserve counts/identities/enquiries and inspect lock waits at production size.
   Prisma deploy uses the existing `db:migrate:deploy` package script. Never run
   the test global setup against a production connection; it recreates test DBs.
3. Provision the shared staging storefront project and server environment values.
   Keep STOREFRONT_ENABLED and default readiness false initially. Inspect client
   bundles/build output for secret values using a private local scanner.
4. Apply additive schema before API code that reads it. Deploy API/worker and web
   with feature off; verify marketplace/auth/inventory/enquiry regressions and
   existing health/readiness/metrics. Old code stays schema-compatible.
5. Deploy the shared storefront in staging through the owner-controlled workflow.
   Unknown hosts must return noindex 404; API/network failures return 503 without
   a fallback dealer. Root may deliberately be unavailable without a registered
   tenant; do not use an unknown root page as a false health signal.
6. Configure provider credentials for the staging shared project only. Test TXT
   proof, delayed verification, routing recommendations, TLS, primary redirects,
   ownership loss, removal-pending, provider retry and fresh re-add proof using
   domains actually owned for testing. Do not use somebody else's domain.
7. Verify wildcard DNS/TLS and renewal. Only then attest default readiness. Enable
   storefront functionality, create two synthetic dealerships, choose both
   themes, preview, activate and test tenant-specific HTML/inventory/metadata.
8. Complete browser activation/theme/media/enquiry/domain journeys and responsive
   review at 320/375/390/768/1024/1440px. Test keyboard/focus/dialog, contrast,
   navigation, filters, long names, loading/failure, empty stock and images.
9. Measure production-like p50/p95 API/SSR/image latency and database operations.
   V1 intentionally uses no shared HTML/data cache. Target the existing 1,000ms
   slow-API alert; do not convert one local benchmark into a production SLO.
10. After separate owner authorization, repeat the sequenced schema/code/feature
    rollout in production, starting with one approved internal test tenant.
    Verify marketplace URLs, cookies, OTP, moderation, enquiries and media.
    Gradually enable approved tenants; never backfill ACTIVE websites.

## Monitoring, health and incident actions

Existing request IDs, pino, HTTP/database metrics, Grafana/Loki and health routes
remain authoritative. Storefront outbound API logs include request ID, route,
status and duration, without customer data or credentials. Watch resolver 404
rates, provider check failures, stale-domain check ages, removal backlog,
activation failures, enquiry errors, 503s and slow inventory reads. Unknown-host
events are generic to avoid high-cardinality host-label abuse. Correlate an error
with request IDs rather than a customer's number or an enquiry ticket.

Probe the shared API readiness and a designated registered synthetic tenant's
homepage/cars/car/robots/sitemap. Validate actual HTTP status and no-store headers,
not only Vercel build success. A blank/unknown-host 404 is correct fail-closed
behavior; alert separately if the designated tenant fails.

Emergency tenant suspension: use the existing audited admin dealership suspension
operation. It atomically suspends the website; subsequent public HTML/API/media
reads fail closed. Dealer reinstatement requires explicit owner website
reactivation. Per-site disable retains records and reservations. No global
revalidation cache is required: requests are dynamic/no-store; image delivery
checks current eligibility before ETag/bytes.

Global rollback: set STOREFRONT_ENABLED false and restart/redeploy API/worker;
disable default readiness if wildcard infrastructure is unhealthy. Restore prior
application artifacts using the existing release procedure. Keep additive tables,
columns and business data; never down-migrate retained enquiries. Reconcile any
provider attachment whose external add succeeded before an interrupted DB commit
against audit/project/ownership proof. Never silently move or claim a deployment.

Hourly branding cleanup deletes only uploads older than 24 hours with no retained
website reference. It locks against branding saves, marks unreferenced assets
ORPHAN before storage deletion, restricts keys to the owned upload prefix and
retains failed cleanup for retry. Disabled/draft website assets remain retained.

## Explicit external verification status

Consult the final-head CI, deterministic tests, local browser/API journeys and
verification matrix in the PR-numbered evidence branch before approving rollout. Real Vercel project/root/env settings, live DNS,
ownership TXT, wildcard certificate issuance/renewal, real provider token scope,
production latency and full staging browser workflows with real identity/provider
boundaries are **unverified**.
No production rollout should occur until these checklist gates are satisfied.

### Vehicle-photo optimization

With the feature enabled, the existing worker also uses its `media.process` job
for bounded approved admin-photo derivative batches. It writes metadata-free
320/640/1024/1600 WebP variants through the existing storage and media models,
without changing listing approval or duplicating images/inventory. Missing or
corrupt source bytes retain the original for retry, with a 15-minute retry
delay so unavailable older objects cannot starve newer uploads. The additive
media retry column/index preserves existing READY records and originals. Removed-image derivatives
are deleted only from the worker-owned prefix; failed cleanup is retained.
Monitor processing backlog and failures. The worker is inert for this processing
when the storefront feature is off. Browser rendering still handles missing
storage safely; no image processor runs on arbitrary public GET requests.
