# Dealers-Drive V1 legal/privacy evidence — 8 October 2026

[Draft PR #279](https://github.com/shashikiran6sk/DealersDrive/pull/279) remains open for owner and qualified Indian legal counsel review. No merge, production migration, deployment or publication was performed.

| Reference | Value |
| --- | --- |
| Feature branch | `feature/legal-compliance-and-consent-v1` |
| Supplied/main baseline | `2a1845abcab9a6cf8b9fc3658cb5c92bf3c92566` |
| Reviewed implementation | `23aed0c650136a87e85707d8c377b8945db7f0d0` |
| Change size | 121 files; 4,598 additions; 51 deletions |
| Legal draft version | `1.0-draft.1`; no effective date or approval |
| Migration | `20261008120000_legal_evidence` — additive; local test/preview only |
| Recommendation | Technically ready for review; legally and operationally blocked from publication |

## Delivered scope

The [review packet](legal-review-pack/DRAFT_DOCUMENTS.md) contains Terms, Privacy (including cookies), Dealer Agreement, Listing/Photography Policy, Grievance Redressal and Data Rights. Related files include the complete feature/endpoint audit, personal-data inventory, actual disclosure/provider map, authoritative-source legal matrix, factual/counsel decisions and operations/release procedure. The audit is scoped to the supplied V1 baseline, excludes V2 mechanical inspection and does not manufacture business identity, statutory appointment or operational guarantees.

Choices are separate, unticked and contextual at customer creation, dealer onboarding/verification, existing-user/owner checkpoints, enquiry sending and listing submission/resubmission. Google/OTP are identity steps rather than contractual assent. Only an active OWNER making an express authority declaration can bind the dealership. Assisted sales cannot impersonate the owner and require the owner's declaration matching the current material listing revision. There is no optional marketing integration or bundled marketing consent.

Receipts preserve actor, tenant/subject, server time, version, exact-text digest and action; Terms, notice acknowledgement, sharing permission, withdrawal and certification differ. Strict API input, transaction checks, idempotency, private histories, account-merge preservation and append-only database triggers support the workflow. Existing accounts get no fabricated backfill. Login/support/privacy requests remain available when new Terms are declined.

Withdrawal checks ownership and masks subsequent dealer reads, excludes previews and stops pending email jobs. Already delivered or in-flight information cannot be recalled. The rights page uses the existing support workflow for access/correction/deletion; verified monitored contacts, operations and a legally approved retention/erasure programme remain release blockers.

## Executed checks

| Check | Result | Evidence |
| --- | --- | --- |
| Frozen-lockfile install | Pass; no dependency/lockfile edits | [Install log](logs/install.log) |
| Format, lint and documentation references | Pass, all six Turbo tasks | [Lint log](logs/lint.log) |
| All-package typecheck, including sandbox | Pass | [Typecheck log](logs/typecheck.log) |
| API full real PostgreSQL 16 integration/unit suite | 153 files / 3,032 tests pass | [API coverage log](logs/api-tests-coverage.log) |
| API coverage gate | Statements 95.83%, branches 90.36%, functions 97.97%, lines 96.93%; every gate above 90% | [API coverage log](logs/api-tests-coverage.log) |
| Additional production-config release-gate suite | 82 tests pass after adding four cases | [Config gate log](logs/legal-production-gate.log) |
| Full web suite | 122 files / 1,485 tests pass | [Web log](logs/web-tests-final.log) |
| Contracts suite and coverage | 429 pass; statements 98.15%, branches 93.75%, functions 95.83%, lines 98.64% | [Contracts log](logs/contracts-tests.log) |
| API/Next production build | Pass | [Build log](logs/build.log) |
| Storybook build | Pass; restored missing existing dealer-close mock export | [Storybook log](logs/sandbox-build.log) |
| Terraform 1.9.8 fmt/init without backend/validate | Pass; no state, AWS access or plan | [Fmt](logs/terraform-fmt.log), [init](logs/terraform-init.log), [validate](logs/terraform-validate.log) |
| Dependency audit at critical level | Pass; zero critical; six moderate and six high advisories reported | [Audit log](logs/audit.log) |
| Additive migration | Applied to isolated synthetic preview and integration databases only | [Preview migration](logs/preview-migration.log) |

The full API suite preceded the final four production-env test additions; the updated config file was then run separately (82 passing). The typecheck and final format/lint covered the final committed tree. Focused legal tests also prove real sessions/OTP proof handling, rejected stale choices, active owner authority, cross-tenant refusal, privacy tickets without Terms, withdrawn customer-only reads, email masking, append-only DML/TRUNCATE refusal, merged-user history and assisted-owner revisions. These focused runs overlap the full-suite totals and should not be added to them.

Cloud networking required permitted sockets for PostgreSQL/HTTP tests. Turbo's strict environment filtered the inherited HTTP proxy and caused a Google Fonts DNS failure; the successful build preserved proxy and CA variables using `pnpm build --env-mode=loose`. The web suite used two workers to avoid excessive local worker creation. No checks were removed or weakened. One legacy test was updated to require 400 for an arbitrary client-selected submission state, assert the draft stayed unchanged, and then exercise valid empty submission. Snapshot digest pins protect the canonical legal text.

## Actual browser verification

Chromium exercised the built Next application, actual local API/session logic and an isolated `dealersdrive_legal_preview` PostgreSQL database. Fixtures are synthetic, marked LOCAL — NOT REAL DATA. Fixed fake OTP and console mail are local adapters; live Google/MSG91/Resend/R2 delivery was not tested. No session token, runtime secret or private fixture JSON is included in this evidence.

All six public legal routes and the Terms archive were checked at 390×844: correct heading, `noindex, nofollow`, no horizontal overflow and no broken table-of-contents anchors. Desktop captures use 1440×1000. Customer signup had two initially unchecked required choices; enquiry permission named Preview Motors; an existing owner saw separate personal/dealership checkpoints with all authority choices initially unchecked. Actual synthetic signup, dealer agreement, enquiry grant and withdrawal completed through the product UI. History and withdrawal confirmation were captured. The listing declaration appeared unticked on the real listing review page.

A second runtime of the same built app with `APP_ENV=production` and enforcement disabled returned **404** for `/terms`, `/privacy`, `/dealer-terms`, `/listing-policy`, `/grievance`, `/data-rights`, `/legal/terms/1.0-draft.1` and `/legal/notices/enquiry/1.0-draft.1`. The sitemap had zero legal entries. Unit config tests additionally refuse production draft collection. Public drafts were therefore not leaked by a build performed in local mode.

## Screenshots

[Manifest with SHA-256 digests](screenshot-manifest.json); screenshots are local review evidence, not a production rollout.

| Surface | Desktop | Mobile |
| --- | --- | --- |
| Draft legal document | [Terms](screenshots/terms-desktop.png), [Privacy](screenshots/privacy-desktop.png) | [Terms](screenshots/terms-mobile.png) |
| Legal footer links | [Footer](screenshots/footer-desktop.png) | [Footer](screenshots/footer-mobile.png) |
| Customer account choices | [Signup](screenshots/customer-signup-unticked.png) | [Signup](screenshots/customer-signup-mobile.png) |
| Named enquiry disclosure | [Enquiry](screenshots/enquiry-permission-desktop.png) | [Enquiry](screenshots/enquiry-permission-mobile.png) |
| Existing owner and authority | [Checkpoint](screenshots/existing-owner-checkpoint.png), [Authority](screenshots/dealer-authority-unticked.png) | Covered by shared-choice mobile tests |
| Listing declaration | [Review](screenshots/listing-certification-desktop.png) | [Review](screenshots/listing-certification-mobile.png) |
| Rights, withdrawal and history | [Rights](screenshots/data-rights-withdrawal.png), [confirmation](screenshots/withdrawal-confirmed.png), [history](screenshots/customer-history.png) | Covered by page overflow probes and shared form tests |

## Release blockers and limits

Owner confirmed one person currently manages the platform and supplied “19th street lakshmipuram 19th street gandhinagar.” That does not establish contracting legal name/form, complete official address, appointed grievance officer or monitored contacts. These facts must be verified. Counsel must approve exact current texts, signatory authority, marketplace classification, staged legal commencement, statutory complaint processes, lawful bases, jurisdictions and liability/licences. Operators must approve retention/holds/deletion/backups, provider geography/agreements and incident/security practices. Details are in [Open decisions](legal-review-pack/OPEN_LEGAL_DECISIONS.md) and [Operations](legal-review-pack/OPERATIONS_AND_RELEASE.md).

Normal event-table mutations are blocked, but a privileged database owner can change triggers or DDL; administrator-proof custody is not claimed. No automatic production erasure, statutory consent-manager or new marketing system was built. Offline officer contacts, full rights operations, timely statutory grievance handling and actual security/provider controls cannot be established by legal prose or local tests. The application flags and metadata remain unapproved and disabled for production. Indian legal counsel and the owner must complete a separate approval and activation review before release.

## GitHub CI

[CI run](https://github.com/shashikiran6sk/DealersDrive/actions/runs/37738602165) and [Security run](https://github.com/shashikiran6sk/DealersDrive/actions/runs/37738602106) started for the exact implementation SHA. Final observed results will be recorded in `CI_STATUS.md` before handoff; local pass results above are not substituted for remote CI status.
