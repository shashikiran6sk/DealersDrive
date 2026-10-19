# #291 — canonical service locations · independent review

PR: [#291](https://github.com/shashikiran6sk/DealersDrive/pull/291) · branch
`feat/dynamic-service-locations` · base `main`. Original author evidence:
[`../pr-04-service-locations`](../pr-04-service-locations).

| SHA                  | Value                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------- |
| `main` at review     | `e8f0e55` (#289 squash)                                                               |
| Original PR head     | `aaceb01` (parent in stack `451ac4e`)                                                 |
| Reconciled           | `69665d4` — merge commit, tree = main + `451ac4e..aaceb01` (byte-identical increment) |
| Final validated head | `4f11619`                                                                             |

## Review

Strong PR. Additive transactional migration: 36 states/UTs, exactly the 38
Tamil Nadu districts (checked against the official list), only Tamil Nadu
onboarding-enabled. Composite FK `(serviceDistrictId, serviceStateId)` makes a
district/state mismatch impossible in PostgreSQL. Backfill maps only exact
reviewed aliases and flags everything else `locationReviewRequired` — nothing
guessed, nothing deleted. Audit index built `CONCURRENTLY` in its own
single-statement migration. Registration resolves the location inside the
transaction with `FOR SHARE`, so a concurrent disable cannot slip a dealer in.
Admin writes need `admin:config:write`, use optimistic versions and audit.
Legacy district URLs (`trichy`, `nilgiris`) map to canonical slugs.

Migration on representative existing data (local dev DB, 124 dealers): 34
Tamil Nadu dealers matched canonically; 90 Karnataka/Kerala/Andhra Pradesh
dealers retained and flagged for review; 0 Tamil Nadu dealers unmatched.

| Sev           | Finding                                                                                                                                                                                                                                                                                             | Resolution                                                                                                                                                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2            | **District search could not find common names.** The combobox matched only display-name substrings and the public catalogue (rightly) hides aliases, so "Trichy", "Tuticorin", "Kanchipuram" showed "No available districts match." on every onboarding form — reproduced in the browser at 390 px. | `4f11619`: match also through the reviewed legacy map already in contracts (`canonicalDistrictFilterSlug`); display/post the government name. Component + unit regression tests; test proven to fail on the old matcher. Re-verified in the browser. |
| P2 (repo DoD) | New shared `ServiceLocationFields` lacked barrel, constants file, sandbox story/registry entry and component-map entry (CLAUDE.md §4b/§6).                                                                                                                                                          | `aacebf1`: added all four; strings moved verbatim; tests unchanged except import path.                                                                                                                                                               |
| P3            | `service-locations.routes.ts` registers routes inline rather than one file per route (§4b); its operations live in `admin.docs.ts`/`config.docs.ts`, not a module `*.docs.ts`. OpenAPI test passes both directions.                                                                                 | Noted.                                                                                                                                                                                                                                               |
| P3            | `ServiceLocationsEditor` (admin feature component) has no sandbox entry.                                                                                                                                                                                                                            | Noted.                                                                                                                                                                                                                                               |
| P3            | Changing an existing dealer _into_ a district that is not onboarding-enabled is refused, also for admins. Defensible; existing records are untouched.                                                                                                                                               | Noted.                                                                                                                                                                                                                                               |

No P0/P1.

## Executed checks

| Check                                                   | Result                                                                                                                              |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Reconciled `69665d4`: lint, typecheck, test, build      | PASS — contracts 445, web 1,506, API 3,121                                                                                          |
| `aacebf1` (refactor): lint, typecheck, full test, build | PASS — same counts (local log not retained; CI re-ran the full suite on the final head)                                             |
| `4f11619` (fix): lint, typecheck, web tests, build      | PASS — web 1,510                                                                                                                    |
| Real stack (`next start` + built API + migrated dev DB) | public catalogue: Tamil Nadu only, 38 districts, no aliases leaked                                                                  |
| Authorization via API                                   | super-admin GET 200 · moderator PUT 403 · anonymous PUT 401                                                                         |
| Browser `/admin/config` 390 / 1280                      | editor renders, Tamil Nadu + districts listed, no overflow                                                                          |
| Browser sales draft edit 390                            | state shows "Tamil Nadu"; "trichy"/"tuticorin"/"kanchipuram"/"nilgiris" each find their district; selected value visible and posted |

Local sessions were minted directly in the local dev database (no Google
configured locally); production auth was not exercised.

## CI on `4f11619`

| Check                           | Result  | Run                                                                                      |
| ------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| Vercel Preview Comments         | success | https://github.com/shashikiran6sk/DealersDrive/runs/114574884964                         |
| lint · typecheck · test · build | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38174760389/job/114574706449 |
| terraform fmt / validate        | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38174760389/job/114574706429 |
| semgrep                         | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38174760434/job/114574706424 |
| gitleaks                        | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38174760434/job/114574706239 |
| dependency audit                | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38174760389/job/114574706230 |
| Vercel                          | success | https://vercel.com/dealers-drive/dealersdrive-prod-web/E3C9Wx1Y9rhi6bqhLgK7jQaepXtv      |
