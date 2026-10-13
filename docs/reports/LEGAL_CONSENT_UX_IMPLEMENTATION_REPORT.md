# Legal and consent UX implementation report

## Baseline audit and implementation checklist

Verified GitHub main on 13 October 2026: `638a618baa7825c4a64609f92b85386c2ee9cd1d`, merged PR #304. Feature branch: `feat/legal-consent-ux-consolidation`. PR #279 remains OPEN and unmerged at `4c1bb0a2`; its legal documents and receipt migration are absent from main. No production database or real customer records have been accessed. Consequently there is no evidence here that any draft was published or accepted by real users. Deployment owners must establish that separately before release.

Read repository `CLAUDE.md`, project feature/component maps and git strategy, engineering documentation for enquiries and sales, and the legacy architecture reference. No applicable AGENTS.md exists in the workspace or parent directories. The explicit consolidation request supersedes the historical reconstruction-only port instruction.

Relevant changes since the baseline used by #279: mobile shells (#285/#294), service locations (#291), private documentary review and separate activation (#297/#299), optional GST transitions (#298/#302), verified owner account provisioning at assisted creation (#301), approval emails/document page (#303), and shared gallery (#304). Preserve these current flows when adapting #279's existing legal abstractions.

Affected architecture: strict contracts; Express legal facade/routes/OpenAPI; PostgreSQL Prisma models/migrations; authenticated enquiry service, dealer inbox/dashboard and notification worker; owner account and dealer submission; admin standard/manual activation and listing moderation; shared legal UI, account settings, public footer and archive routes; existing map resolver/public address mapper and location card; sandbox stories and existing integration/unit tests.

- [ ] Adapt #279 evidence, immutable archives and publication gates to latest main.
- [ ] Consolidate Terms/dealer/listing and Privacy/rights notices into two new review drafts; retain original snapshots and identifiers without migrating acceptance.
- [ ] Redirect old policy routes with stable anchors; retain contextual notices and privacy/grievance controls.
- [ ] Use one linked unticked account control and one owner dealership control at successful final submission; remove premature draft acceptance requirements.
- [ ] Add authenticated dealership-scoped append-only grants/withdrawals and enquiry evidence associations, transaction locks and idempotency.
- [ ] Enforce server recipient/identity/scope checks for every disclosure, including inbox, dashboard and pending emails; add discoverable withdrawal.
- [ ] Require actual active owner acceptance before assisted submission, standard/manual activation and listing publication; preserve representative attribution and existing service-region scope.
- [ ] Remove public iframe; generate encoded directions from validated business location with safe incomplete-address fallback; retain address management/geocoding.
- [ ] Add regression/security/migration/UI tests and execute all feasible checks using only local synthetic data and fake providers.
- [ ] Document Indian commencement sources, factual/counsel release blockers, compatibility, monitoring and evidence-preserving rollback.
- [ ] Review final diff, commit logical changes, push feature branch and create one Draft PR; do not merge, deploy or publish drafts.

## Operational requirements retained

Authentication/OTP is distinct from contract acceptance. Customer identity comes from the session; enquiry recipient comes from the locked listing. Existing advisory duplicate guards and availability rules remain. Sales access is limited to its own assisted dealers and permitted service locations; verified contact channels provision the real owner account, not a sales-owned impersonation. Private documents, documentary verification, independent approval, standard/manual activation distinctions, notification delivery and listing state machines remain. Historical receipts must never be deleted, renamed or rehashed. No approved retention/contact/officer information is inferred from source defaults. No production legal enforcement or publication flag is enabled by this work.

## Executive summary

Implementation and verification in progress.

## Release readiness

**NO GO** while implementation, automated validation and legal review remain incomplete.
