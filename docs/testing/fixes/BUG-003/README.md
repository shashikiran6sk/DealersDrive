# BUG-003 — complete equal-time pagination

DATA-DISC-001/002/003 retain their original baseline FAIL. The unchanged stacked parent `d29d9b960a1835d61a89e80b03de63430adc1bdc` reproduced all three failures before implementation: three database rows yielded pages 1+0. The built browser reproduced Saved Cars 50+0, customer enquiries 20+0 and dealer inbox 25+0 against 51 database rows. [Reproduction and root cause](REPRODUCTION.md), [baseline browser result](browser-baseline.json) and sanitized `evidence/ci/bug003-baseline-red.log` preserve the red evidence.

Branch: `fix/pre-production-03-stable-pagination`. Required PR base: `fix/pre-production-new-005-rejection-race` (#233). [PR #234](https://github.com/shashikiran6sk/DealersDrive/pull/234) is open; remote CI PENDING. No merges. Product commit: `c0d8e3acd98510120a4401479eb959bcc9711942`. Full-suite and final browser tested commit: `20c1b39efeab1b5885bb42774b2b594e5f4fffd2`.

## Correction

Saved Cars and customer/dealer enquiry reads already sort by createdAt and UUID descending, but their cursors contained only the timestamp. The next-page filter excluded every remaining tied row. The three reads now emit the existing timestamp/UUID keyset format and use the matching lexicographic boundary. Ownership and status conditions remain outside the boundary OR. Existing session guards, mappers, counts, lifecycle writes, schema and frontend are unchanged. OpenAPI and code facades document the boundary.

The new decoder is limited to these three collections. Existing date-only cursors remain accepted with their original exclusive timestamp semantics. They cannot recover the absent UUID; refreshing the collection obtains a complete new boundary. Existing strict Admin keyset and unrelated date/sequence APIs are unchanged.

The accumulated fixture exposed an existing Admin pagination test oracle that compared a complete traversal with only its first 100 rows. Supporting test-only commit `20c1b39` compares the traversal with the complete database collection, verifies the first-page prefix/hasMore and bounds traversal. Admin product code is unchanged.

## Automated verification

- `apps/api/tests/stable-pagination.test.ts`: 15 real HTTP/DB regressions, including the original three failing cases, page sizes 1/2/3/5, mixed timestamps, millisecond precision, deleted boundary rows, repeat requests and old cursor compatibility.
- Negative coverage: malformed cursors, invalid limits, anonymous callers, forged ownership fields, foreign cursor IDs and actual cross-customer/dealer sessions.
- Lifecycle coverage: ACTIVE/RESERVED/SOLD/WITHDRAWN listings, NEW/CONTACTED/CLOSED/SPAM enquiries, ACTIVE/SUSPENDED dealers, availability/images, customer history, inbox totals and status counts. Database snapshots verify reads preserve saved rows, enquiry state, timestamps and audit counts.
- Authorization coverage: an existing manager session after STAFF role change, actual membership removal and stale-cookie denial; customer logout, stale-cookie denial and fresh sign-in retaining complete owned history.
- Targeted integration: 157 PASS across seven affected/adjacent suites. Pagination/Saved/Enquiry unit coverage: 41 PASS. Early targeted-run metadata records parent HEAD while the implementation was still uncommitted; the subsequent complete suite and browser proof run against committed `20c1b39`.
- Full accumulated suite at `20c1b39`: **4,428 PASS** — API 2,662 (129 files), web 1,346 (99 files), contracts 420 (14 files). API coverage: statements 96.97%, branches 92.32%, functions 98.36%, lines 97.81%; repository thresholds PASS. [Complete API assertions](evidence/ci/api-assertions.json), [web](evidence/ci/web-assertions.json), [contracts](evidence/ci/contracts-assertions.json), and `bug003-full-tests-green.log` retain exact results.
- Final root lint, typecheck and fresh production build: PASS at `20c1b39`; Turbo cache bypassed. Local full-history secret scan: PASS at evidence commit `e6c6ae3`, 227 commits scanned with the actual cached CI image; [metadata](evidence/ci/bug003-history-secret-scan.json).

## Browser and evidence

[Final browser result](browser-fixed.json) passes nine cases at 1440/768/390 pixels with real cookies, the real API and PostgreSQL in isolated inert fixtures. Each collection visits all 51 database rows once in exact order: Saved 50+1, customer 20+20+11, inbox 25+25+1. All nine refresh and browser-back checks PASS. Document width equals viewport width in the tested collection pages; Saved image requests decode actual marked fixture JPEGs. These functional results do not close unrelated Admin/onboarding mobile findings or certify every dealer header element.

Six baseline and 24 fixed-state screenshots are retained alongside the scripts. All six corrected baseline and all 24 fixed screenshots were visually inspected. Representative evidence: [saved mobile final page](fixed-saved-390-page2.png), [customer mobile final page](fixed-customer-390-page3.png), [inbox mobile final page](fixed-inbox-390-page3.png). Human UAT remains PENDING; Chromium is not real-device certification.

`browser-fixture.mts` asserts local certification DB, fake providers, disabled jobs, local storage and matching media/API origins. Private session data remains outside Git in a permission-restricted temporary file. No live providers, customer data or production systems were used.

## Retained failed attempts and separate findings

Sanitized failed attempts remain available. Expanded-test failures came from asserting an incorrect error-envelope field; lifecycle setup used the dealer logout route for a customer; initial typecheck required explicit response annotations. These harness issues were corrected and verified. The first full run had 4,427 PASS/1 FAIL from the Admin 100-row oracle above; complete assertions remain under `evidence/ci/full-first-failed`. The first refresh/back harness asserted DOM state before the Next transition finished; deterministic URL and expected-row readiness now precede the same assertions. No frontend source change was needed. Initial browser media-origin misconfiguration and the first fixed browser result remain under `evidence/diagnostics`.

BUG-NEW-007 (P2) is independently reproduced in dealer inventory: 51 tied vehicle rows yield pages 1+0. [Diagnostic report](evidence/inventory-pagination-finding.json) and its script preserve the finding; the script restores all fixture timestamps in finally and verifies restoration. Inventory source is unchanged. It requires a dedicated later stacked PR. A narrow dealer-header avatar appearance in long fixture branding remains an unconfirmed visual lead, not a silently fixed or confirmed bug.

[Canonical traceability](canonical-retests.json) keeps baseline FAIL separate from scoped Agent PASS. Entire 556-case certification, final complete-stack regression, live-provider/deployment gates and Human UAT remain pending. Production GO has not been established.
