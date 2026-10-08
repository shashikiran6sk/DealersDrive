# White-label V1 architectural assessment

Audit date: 8 October 2026. Baseline: `2a1845abcab9a6cf8b9fc3658cb5c92bf3c92566`.
The working tree was clean; `main` was fast-forward refreshed from `origin`.
No storefront implementation exists at this baseline. This campaign implements
a new product rather than reproducing the historical reconstruction baseline.

## Current architecture and audit answers

| Question                | Finding and implementation consequence                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toolchain               | Node 24, pnpm 9.15.9, Turbo 2, strict TypeScript 5.9, Zod 4, Next 15.5, React 19, Express 5, Prisma 7 with the PostgreSQL adapter. Add one shared Next application to the existing workspace.                                                                                                                                                                                                                   |
| Dealer resolution       | Cookie resolver reads an unrevoked, unexpired session, active user/DEALER seat, and current server-side membership on every request. `activeDealerId` is a preference, never a grant. No management input accepts a dealer ID.                                                                                                                                                                                  |
| Membership              | `DealerMember` has OWNER/MANAGER/STAFF and ACTIVE/removal lifecycle. Existing write authorization rechecks and locks dealer, member, user, role seat, and session within the transaction. Reuse it.                                                                                                                                                                                                             |
| Editing roles           | Existing profile changes are OWNER only. New storefront read permission is OWNER/MANAGER; branding, publication, activation and domain management are OWNER only. STAFF get no website administration.                                                                                                                                                                                                          |
| Suspension/closure      | Cookie and transactional guards refuse suspended/closed dealers. Public search requires ACTIVE. Storefront resolution must check dealer status on every request regardless of saved website state; suspension must require deliberate reactivation. Retain all business records.                                                                                                                                |
| Customer/dealer overlap | One user can hold CUSTOMER and DEALER seats, with distinct session scopes. Existing customer guard also admits a dealer with a verified phone and name. Preserve this.                                                                                                                                                                                                                                          |
| Moderation              | Listing approval runs the existing state machine, checks and photography approval; only ACTIVE/RESERVED and a non-null listing slug are publicly visible. Do not introduce a second approval system.                                                                                                                                                                                                            |
| Listing lifecycle       | RESERVED is visible but unavailable, with no active detail navigation/enquiry. SOLD and WITHDRAWN are absent from public search. The historical CLAUDE visibility text is stale; actual code takes precedence.                                                                                                                                                                                                  |
| Publication             | Add independent booleans on Listing, both default true. Existing records retain marketplace behavior; website visibility additionally requires an explicitly activated website. Both false is supported. No inventory duplication.                                                                                                                                                                              |
| Media                   | Existing admin vehicle-photo attachment/processing pipeline, READY media and 320/640/1024/1600 WebP derivatives. Private KYC is served separately with authorization. Public delivery rechecks eligibility, uses ETags and `no-cache`. Branding must use owned READY references, never arbitrary image URLs or private signed URLs.                                                                             |
| Public APIs             | Existing search mappers provide explicit vehicle DTOs, pagination and filters, but global detail/similar APIs cannot be reused without a tenant predicate. Reuse contracts, filter helpers and mappers; add tenant-scoped queries. Dealer public profile omits phone and contains marketplace attribution, so add an explicit storefront DTO.                                                                   |
| Enquiries               | One existing Enquiry table, dealer/customer/admin inboxes, customer-derived identity, dealer derived from listing, outbox notifications, audit and locked eligibility check. Add additive source/storefront/hostname/consent fields. Reuse the transaction, duplicate guard and notification event.                                                                                                             |
| OTP/consent             | Phone sign-in uses MSG91 in production and fake tokens only locally/test. Existing enquiries require a verified customer account. There is no published legal-consent framework on main. PR #279 is open for gated legal/privacy work; do not silently copy it. Storefront enquiries must retain verification and explicitly record their disclosure consent; legal text needs qualified review before rollout. |
| Cache                   | Web marketplace uses tagged Next fetch caching; API config uses CachePort with shared version polling. Storefront V1 uses dynamic, `no-store` HTML and tenant-scoped API reads, so sold/withdrawn inventory and suspension are observed on the next request. No global fallback tenant or shared HTML cache.                                                                                                    |
| Failures                | Existing RFC 9457 API errors, request context, pino, Prometheus, health probes and web BFF timeout/error handling. Reuse these conventions; distinguish unknown tenant 404 from infrastructure failure 503. Storage failure yields safe missing-image behavior.                                                                                                                                                 |
| URLs/SEO                | Marketplace owns `/dealers/[slug]`, `/cars`, `/car/[slug]` and its existing sitemap/canonicals. A separate storefront app preserves these URLs; its routes are relative to its verified primary hostname. Same-dealer related cars only.                                                                                                                                                                        |
| Hosting                 | Committed web Vercel config selects `bom1`; GitHub release/promote controls production deployment. AWS Terraform region is `ap-south-1`; Express/database/media remain shared. Recent PR comments prove an existing Vercel web preview project, but live project settings/DNS/provider credentials were not inspected. Do not infer infrastructure readiness from source.                                       |
| Flags/config            | Existing platform config supports feature flags, defaults, audit and cross-instance polling. New server-side `STOREFRONT_ENABLED=false` and `STOREFRONT_DEFAULT_DOMAIN_READY=false` make newly deployed code fail closed. A dedicated shared service secret protects host assertions from the storefront server.                                                                                                |
| CI                      | Mandatory main protection: lint/typecheck/test/build, dependency audit, Semgrep, Gitleaks. Terraform fmt/validate also runs. API and contracts enforce 90% coverage. Real PostgreSQL integration setup recreates only `dealersdrive_test`. Extend PR workflow base filters to `feat/white-label-*` so dependent PRs execute the same gates. Do not change branch protection.                                    |
| Evidence                | Existing `testing_evidence` branch uses `docs/testing/` with synthetic fixtures, logs, screenshots and PR references. User requests a separate `testing_branch` with PR-number directories and only 2–3 screenshots. Keep test source in feature PRs; keep execution artifacts on that separate branch.                                                                                                         |

## Decisions, boundaries and risks

- Control plane stays in the authenticated marketplace dashboard; shared Express
  API is the data plane; `apps/storefront` will be public presentation only.
- One storefront per dealer, globally unique normalized subdomain and hostname,
  retained domain tombstones, unique default/primary indexes, explicit website
  and domain lifecycles. Security-sensitive state is typed columns, not JSON.
- Host assertions from Next use a dedicated server credential. Ignore arbitrary
  forwarded-host headers. Unknown, unverified, inactive and suspended tenants
  fail closed. Custom domains never share dashboard authentication cookies.
- Enquiries on custom domains need a central verified-customer handoff, preserving
  the existing OTP and account boundary. Browse remains anonymous. The handoff
  must bind hostname/listing and recheck authoritative eligibility at submission.
- Domain ownership uses fresh tenant-bound TXT proof plus provider verification,
  routing and TLS readiness. No domain transfers between deployments, automatic
  tenant reassignment, live DNS changes or production provider writes in this campaign.
- Exactly LIGHT/DARK with shared data logic. Branding is bounded plain text,
  constrained URL hosts and owned processed media. Verified dealer contact is
  explicitly publishable only on their own branded website.

Migration is additive and transactional. Existing publication defaults and enquiry
source are retained; no websites are backfilled or automatically activated. Indexes
on existing tables can briefly block writers: schedule migration in a controlled
window, inspect lock waits, and rehearse on a production-sized isolated restore.
Old code can run with the new schema. Rollback disables flags and restores prior
application code; retain tables/columns. Never down-migrate business records.

External prerequisites: one storefront Vercel project, correct wildcard DNS and
TLS, server credentials, approved legal disclosures, provider ownership/routing
configuration, and staged migration. Wildcard Vercel certificates require Vercel
DNS/nameserver handling; moving apex nameservers is a separate owner operation
that must preserve marketplace/API/mail records. If that conflicts with current
DNS, use individually provider-verified default hostnames instead of assuming a
wildcard is ready. No infrastructure changes are authorized here.

Provider documentation reviewed:
[project domain verification](https://vercel.com/docs/rest-api/reference/endpoints/projects/verify-project-domain),
[custom domains and wildcard DNS](https://vercel.com/docs/domains/working-with-domains/add-a-domain).

## Five-PR dependency plan

| PR                  | Parent            | Scope                                                                                                                                                         |
| ------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 foundation        | main              | This audit, schema/migration, reservation and lifecycle invariants, strict contracts, permission table and stacked CI triggers.                               |
| 2 backend           | foundation        | Transactional management, trusted tenant resolver, isolated public inventory, branding media, source-bound enquiries, OpenAPI and integration/security tests. |
| 3 storefront        | backend           | Shared Next application, responsive LIGHT/DARK, public pages, media, enquiry handoff and theme tests.                                                         |
| 4 dashboard/domains | storefront        | My Website, protected preview, saves, publication controls and provider-backed domain onboarding/removal/primary selection with deterministic tests.          |
| 5 hardening         | dashboard/domains | Adversarial tenant/failure/E2E/SEO/performance review, operational runbook and cumulative verification.                                                       |

Every branch starts at its parent's latest committed head, passes required checks
at its final SHA, and remains open. No merges, auto-merge, production deployment,
paid purchase or live DNS change. PR descriptions record parent/head SHAs,
executed checks, migration/rollback details and links to external evidence.
