# PR 5 — optional dealer tagline

Branch: `feat/optional-dealer-tagline`. Base: `feat/dynamic-service-locations` (#291).
Head: `a894c1b308e5c5a75ab7cc7aa357a5a1aab8148c`. PR pending creation. Unmerged.

## Implementation

Optional marketing text across self/assisted registration, admin edits and dealer profile.
Blank/null text normalizes to null; omitted patches preserve existing values. Shared 200
character maximum, plain text rendering, no fabricated marketing sentence or public empty
placeholder. Active dealer removal still requires review. An explicit proposal flag
separates removal from a services-only edit, and approval/refusal/publication are atomic.

33 files changed. Migration `20261010093000_optional_tagline` adds the intent flag and
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

## After creation

NOT RUN yet. Final-head post-creation testing and GitHub CI remain mandatory before PR 6.

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
Next PR: admin mobile OTP, only after this PR's final-SHA gate passes.
