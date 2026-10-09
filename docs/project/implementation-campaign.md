# Dealers-Drive implementation campaign

## Baseline audit — 2026-10-09

Baseline: `5ce6df503a33df0c199ac90e7a2941ead8c70bcb`, latest `origin/main` at audit time.
The initial working tree was clean. Fetch/prune and fast-forward pull completed.
No merge or production deployment is authorized by this campaign.

### Architecture and current behavior

| Area                   | Source and findings                                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Workspace              | pnpm 9.15.9, Node 24 (`.nvmrc`), Turbo 2.11.7; API, web, contracts, config and Storybook sandbox packages.                                                                                                                                                                                                                                                   |
| Web                    | Next.js 15.5.27, React 19.3, Tailwind 4; App Router with public, authentication, dealer, admin and sales route groups. Server actions/BFF relay API calls and cookies.                                                                                                                                                                                       |
| API                    | Express 5.2.1 modular monolith. Module facades isolate service boundaries; Zod contracts are shared by frontend, route validation and OpenAPI.                                                                                                                                                                                                               |
| Database               | PostgreSQL 16, Prisma 7.10 with the pg adapter. Versioned SQL migrations, synthetic test seed and guarded development seeds. Integration setup recreates dedicated local test databases; never use it against production.                                                                                                                                    |
| Environment            | Root dotenv loading, validated API configuration and production guards; production requires cookie auth, real OTP/mail, R2 and shared PostgreSQL cache. Local providers and auth remain development/test facilities.                                                                                                                                         |
| Authentication         | Google dealer sign-in, Google admin audience, dealer/customer MSG91 widget OTP, verified account linking, pending onboarding principals and role seats. Account merging requires proof of both identities and refuses operator accounts.                                                                                                                     |
| Sessions               | Random opaque tokens stored as hashes, database scope and expiry, revocation and membership checks. Admin scope lasts 12 hours, personal scope 30 days. All currently use `dd_session`, HttpOnly, SameSite=Lax and Secure in production; PR 6 must separate cookie/session consumers end to end.                                                             |
| Admin admission        | `AdminMember` role/status governs current access; bootstrap members also require the allowlist on every request. Admin console permission excludes sales reps. OAuth admits authorized operators; no email/password production login.                                                                                                                        |
| Onboarding             | Self-registration requires verified Google/email and phone. Sales-assisted registration records consent/assistant attribution, verifies phone and sends email proof; typed contact email is not ownership. Dealer claims create ownership only after proof.                                                                                                  |
| Dealer lifecycle       | DRAFT → submitted PENDING_APPROVAL → ACTIVE, with rejection/closure/suspension paths. Admin approval locks parent/documents and requires completeness, three verified committed documents and stored objects. Assistants cannot review their own applications.                                                                                               |
| Submission friction    | Database tagline and GSTIN are nullable, but completeness requires both, business/services/maps/location and PAN. Yard cover is also required. PRs 3/5/11 must update backend gates and every consumer, not only form labels.                                                                                                                                |
| Documents/media        | Dealer documents are private; admin review obtains signed reads. Public media uses ready/visibility checks. Verified document edits are protected. Current yard storage is a single cover, not a multiphoto gallery; preserve existing viewer functionality and do not invent gallery evidence.                                                              |
| Marketplace            | ACTIVE dealer directory/detail, listing moderation and public visibility, typed response mappers, pagination, search and location facets. District/state are normalized strings, city remains separate. Filters use public location facets and URL state; preserve first-selection visibility.                                                               |
| Directory verification | Cards currently select yard media and show “Yard Verified” from cover presence. Public dealer `isVerified` also needs review in PR 10; approval and genuine verification must become distinct.                                                                                                                                                               |
| Configuration          | Typed platform config defaults/readers, admin permission gates and audit records. Geographic master data/serviceability does not currently exist; PR 4 needs additive canonical relationships and safe ambiguous-data handling.                                                                                                                              |
| Support                | Customer-owned tickets, separate authorized admin routes, persisted customer/admin messages, internal notes and audit history. Both reply paths lock the ticket row. OPEN/IN_PROGRESS/WAITING_FOR_CUSTOMER/RESOLVED/CLOSED lifecycle is contract-defined; quota and retry identity need implementation. Attachments are not currently part of message input. |
| Admin UI               | Overview, dealer/document/profile review, listing moderation, enquiries, support, config, notification delivery and members. Preserve the merged responsive layout and console utilities.                                                                                                                                                                    |
| Deployment             | Terraform AWS configuration, API release workflow and Vercel web split. Only validation/build is permitted; do not invoke release, promote, deployment or production migration.                                                                                                                                                                              |
| Documentation          | `docs/project` holds design decisions; `docs/code` holds source notes. Existing lint includes formatting and documentation-reference validation. Turbo automatically generated `AGENTS.md`; retain its managed instructions.                                                                                                                                 |

### Existing work and evidence

Mobile revamp #285 and console cleanup #286 are merged into this baseline.
Open PRs at audit: #280–284 white-label stack; #279 independent legal Draft;
#278 ticket SMS; #239 testing evidence Draft; #210 environment configuration.
The white-label and legal work overlap schema, onboarding, auth/contracts and CI;
do not inherit those unmerged changes. All twelve approved campaign branch names
were absent from remote branches and open PRs.

The historical 556-case registry lives on `testing_evidence` under
`docs/testing/pre-production` and `docs/testing/certification`. Reports contain
automated probes, manual scenarios, historical failures and blocked cases. The
later certification records 543 PASS, 1 FAIL, 10 BLOCKED and 2 NOT_APPLICABLE,
with additional discovered launch defects outside that registry. These counts
are historical and are not a current certification. Some defects have subsequent
fixes in main; reassess current behavior instead of treating reports as executable
tests. Latest white-label artifacts use `testing_branch`; this campaign uses an
isolated worktree of `testing_evidence`, with unique campaign paths, preserving
the already active `testing_branch` worktree.

### Executed baseline checks

| Command                                                      | Result                                                                                                                                                                            |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                             | PASS; lockfile unchanged.                                                                                                                                                         |
| `pnpm --filter @dealers-drive/api db:generate`               | PASS.                                                                                                                                                                             |
| `pnpm --filter @dealers-drive/api exec prisma validate`      | PASS.                                                                                                                                                                             |
| `pnpm lint`                                                  | PASS; format, ESLint and docs references.                                                                                                                                         |
| `pnpm typecheck`                                             | PASS, including sandbox.                                                                                                                                                          |
| `pnpm test`                                                  | Initial sandbox attempt could not connect to local DB. Authorized retry: contracts 427 PASS, web 1,488 PASS, API 3,012 PASS / 2 FAIL due to inherited local environment/timezone. |
| `TZ=UTC APP_ENV=local pnpm --filter @dealers-drive/api test` | PASS: 3,014 tests / 151 files; real DB migration/seed and unit/integration suites; coverage lines 96.98%, branches 90.31%, functions 97.84%, statements 95.95%.                   |
| `pnpm build`                                                 | PASS after allowing network access for Google Fonts; API/contracts and production Next build.                                                                                     |
| `pnpm audit --audit-level=critical`                          | PASS after registry access; six high and six moderate advisories remain.                                                                                                          |
| `terraform fmt -check -recursive`                            | PASS.                                                                                                                                                                             |
| `terraform init -backend=false`, `terraform validate`        | PASS after registry/provider execution access; no backend, plan or infrastructure mutation.                                                                                       |

Baseline assertions total 4,929 passing across the controlled API rerun and the
contracts/frontend runs. This does not represent 556-case certification or real
Google/MSG91/provider UAT. Pin local test environment/timezone explicitly when
running direct package tests. Preserve original failed-run evidence.

### CI gates and campaign sequence

Main requires final-head lint/typecheck/test/build, dependency audit, Semgrep and
Gitleaks, with strict up-to-date checks. Terraform also runs. Existing CI/Security
pull-request triggers select only main; PR 1 adds the ten approved parent bases
so descendants receive the same checks. No jobs, thresholds or protections change.

1. `feat/dd-favicon-sizing` → main
2. `fix/dealer-email-uniqueness` → PR 1 branch
3. `feat/standard-dealer-directory-image` → PR 2 branch
4. `feat/dynamic-service-locations` → PR 3 branch
5. `feat/optional-dealer-tagline` → PR 4 branch
6. `feat/admin-mobile-otp` → PR 5 branch
7. `feat/mobile-admin-access` → PR 6 branch
8. `feat/ticket-message-limits` → PR 7 branch
9. `fix/mobile-sidebar-navigation` → PR 8 branch
10. `feat/dealer-verification` → PR 9 branch
11. `feat/optional-gstin` → PR 10 branch
12. `feat/progressive-dealer-verification` → latest main, independent Draft,
    only after full-stack regression.

Each PR must complete local validation, post-creation testing, evidence and
final-SHA CI before its successor starts. All remain unmerged. Product/legal
requirements in the independent progressive Draft must remain explicit review
decisions, especially RTO classification, GST applicability and evidence minimization.

### Favicon implementation and owner UAT

The first PR 1 CI run exposed an existing asynchronous enquiry regression-test
race: the form's button can appear before its scrolling effect runs. The test
now waits for that same scrolling assertion; the assertion, application behavior,
test count and CI thresholds are unchanged. Keep the original failed CI log and
re-run all gates on the correction's final head before starting PR 2.

`node scripts/generate-favicon.mjs` deterministically rasterizes the unchanged DD
vector contour into browser PNG/ICO assets. The glyph is approximately 25% smaller
than the previous tight crop, centered on the same rounded black tile with
transparent corners. The previous 32% corner radius is preserved. ICO contains
16/32/48 pixel PNG frames; the app PNG is 512 pixels. Homepage logo, Apple touch,
manifest/installed icons and social assets are unchanged. No runtime dependency
is added; generation uses the existing API Sharp dependency.

Review browser tabs on home, dealers, authentication and admin pages in light
and dark browser themes, including a high-DPI display. Compare homepage logo
against main. Next's file metadata adds the icon links; do not add a second
metadata declaration. The PNG metadata URL changes with the build fingerprint;
existing fixed favicon URL may require a hard refresh/browser favicon-cache
refresh. This campaign cannot certify cache behavior after a production deployment
because production deployment is prohibited.
