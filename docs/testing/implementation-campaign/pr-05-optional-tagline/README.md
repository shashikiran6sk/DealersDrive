# PR 5 — optional dealer tagline

Branch: `feat/optional-dealer-tagline`. Base: `feat/dynamic-service-locations` (#291).
Head: `465a5cd129de8b03be02cd551ca9e4bf238a39c6`. PR: [#292](https://github.com/shashikiran6sk/DealersDrive/pull/292), OPEN. Unmerged.

## Implementation

Optional marketing text across self/assisted registration, admin edits and dealer profile.
Blank/null text normalizes to null; omitted patches preserve existing values. Shared 200
character maximum, plain text rendering, no fabricated marketing sentence or public empty
placeholder. Active dealer removal still requires review. An explicit proposal flag
separates removal from a services-only edit, and approval/refusal/publication are atomic.

35 files changed, including two required CI infrastructure corrections. Migration `20261010093000_optional_tagline` adds the intent flag and
backfills historical non-null proposals without altering live text or proposal status.
A guarded scratch-database rehearsal confirmed preservation. Drain old reviewers before
accepting null-removal requests; preserve the flag for pending requests on forward fixes.
No production migration or deployment was performed.

## Before creation — executed

- Fresh full suite: **5,085 PASS** (API 3,119; web 1,508; contracts 458).
- Formatting/lint/documentation checks, all workspace type checks, Prisma generation and
  validation, and forced API/web production builds: PASS.
- Actual migration rehearsal, omission/null/empty/whitespace/short/maximum/overlong cases,
  authorized/unauthorized removal, concurrent decisions, rejection/withdrawal preservation,
  services-only preservation, and blank legacy public serialization: PASS.
- Actual browser UAT: registrations without tagline at 320/390/768/1280; removal held for
  review and published only after admin approval at 390/1280; public absence/no placeholder
  and no overflow. See `pre-pr/browser-results.json`; screenshots are real and sanitized.
- API lines 96.95%, branches 90.20%; existing coverage gate retained.

## After creation — executed on final head

- Fresh final-head suite: **5,085 PASS**, API 3,119/web 1,508/contracts 458. Test caches bypassed.
- Lint/format/docs, all type checks, Prisma validation and forced production builds: PASS.
- Actual built-app browser campaign repeated after creation: PASS, including registrations
  without text and genuine held/reviewed removal. See `post-pr/browser-results.json`.
- API lines 96.95%, branches 90.13%; existing threshold unchanged.
- Initial GitHub attempt and retry failed before tests/scans because Docker Hub refused
  unauthenticated image pulls. Failure evidence retained. Same-PR infrastructure correction
  uses official ECR PostgreSQL, the exact preceding Gitleaks digest on GHCR, and Semgrep
  1.179.0's Python distribution matching the preceding successful container release.
  Seven rule packs, severity policy, complete history scan, redaction, permissions and check
  names retained; scanner execution errors fail closed. No branch protection changed.
- Local alternate-channel scans: Gitleaks no leaks; Semgrep no ERROR/HIGH/CRITICAL findings
  under existing policy and no execution errors (40 MEDIUM/WARNING advisories retained).
- All required checks passed on the final SHA. [CI](https://github.com/shashikiran6sk/DealersDrive/actions/runs/37993422840),
  [Security](https://github.com/shashikiran6sk/DealersDrive/actions/runs/37993422922).
- Preview-only deployment confirmed, production false. Base/head, two scoped commits,
  clean worktree, open/unmerged status and disabled auto-merge verified.
- Final local failed tests: zero. Outstanding PR blockers: none. Existing dependency
  high-advisory reporting is not represented as an absence of vulnerabilities.

## Limitations / owner UAT

Only synthetic local data and controlled providers were used. Native Safari/physical
mobile and live Google/MSG91 UAT are not claimed. Existing prerender API fallback warnings
occurred with the default local API unavailable; builds succeeded and live application
routes were tested against the isolated running API. Historical 556-case reports are not
claimed as current execution results. Private cookies, OTP values, PAN/GST fields and
session fixture files are excluded from artifacts.

Follow `docs/project/optional-dealer-tagline.md`: register without text, test explicit
clearing versus omitted patch, approve/refuse/withdraw active-dealer removal, check public
absence, and preserve unrelated profile data. All PRs remain owner-controlled and unmerged.
Next PR: admin mobile OTP. This final-SHA gate is complete.
