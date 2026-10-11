# #292 — optional dealer tagline · independent review

PR: [#292](https://github.com/shashikiran6sk/DealersDrive/pull/292) · branch
`feat/optional-dealer-tagline` · base `main`. Original author evidence:
[`../pr-05-optional-tagline`](../pr-05-optional-tagline).

| SHA                  | Value                                                                              |
| -------------------- | ---------------------------------------------------------------------------------- |
| `main` at review     | `0d3d201` (#291 squash)                                                            |
| Original PR head     | `465a5cd` (parent in stack `aaceb01`)                                              |
| Reconciled           | `fe32fa0` — merge commit, tree = main + `aaceb01..465a5cd` minus CI workflow edits |
| Final validated head | `cef8c0b`                                                                          |

## Reconciliation

Content hunks identical to the original increment (only blob-hash header lines
differ, because #291's review fixes touched the same files). **Excluded:** the
increment's `ci.yml`/`security.yml` edits (Postgres image moved to ECR Public by
digest, Semgrep from pip, Gitleaks from GHCR) — CI infrastructure, out of scope
for a tagline PR, and every CI run on `main` and this campaign has pulled from
Docker Hub successfully. If Docker Hub rate limits recur, that change deserves
its own focused PR.

## Review

Omitted = unchanged; `null`/blank = remove (`DealerTaglineInput`, one schema
for onboarding and updates). `dealer_profile_changes.taglineChanged` separates a
removal proposal from "not part of this edit"; the migration backfills it for
every historical non-null proposal, so old rows keep their meaning. Completeness
no longer requires a tagline. Public DTOs trim and null whitespace-only legacy
values. Approval/refusal/withdrawal now lock the dealer and the change row and
re-read inside the transaction (fixes a stale-approval race). No placeholder
marketing text anywhere.

| Sev          | Finding                                                                                                  | Resolution                                |
| ------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| P3           | Design doc described the excluded CI changes and carried a campaign-status sentence.                     | Removed (`cef8c0b`).                      |
| P3           | "Remove tagline" / "Remove tagline after approval" are inline JSX strings (§4b constants).               | Noted.                                    |
| P3           | `TAGLINE_MIN` now exported as `0` and unused.                                                            | Noted.                                    |
| Rollout      | A new web against an old API would send blank taglines the old 10-char floor rejects.                    | Promote the API before (or with) the web. |
| Pre-existing | Seeded dealer's hours render "Mon–Sat, 10:00 AM – 8am –". "VERIFIED DEALER" on detail page (#297 scope). | Not this PR.                              |

No P0/P1/P2.

## Executed checks (fresh logs, `fe32fa0`; `cef8c0b` differs by Markdown only)

| Check                                                                           | Result                                                                             |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| lint + typecheck                                                                | PASS                                                                               |
| tests                                                                           | contracts 458 · web 1,512 · API 3,136 (incl. `optional-tagline-migration.test.ts`) |
| build                                                                           | PASS                                                                               |
| Migration on dev DB                                                             | applied cleanly after #291's                                                       |
| Browser: ACTIVE dealer with NULL tagline, detail page 390/1280 + directory card | no placeholder / "null", no overflow                                               |

## CI on `cef8c0b`

| Check                           | Result  | Run                                                                                      |
| ------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| Vercel Preview Comments         | success | https://github.com/shashikiran6sk/DealersDrive/runs/114578239357                         |
| terraform fmt / validate        | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38175910464/job/114578144357 |
| gitleaks                        | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38175910452/job/114578144184 |
| lint · typecheck · test · build | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38175910464/job/114578144138 |
| semgrep                         | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38175910452/job/114578144047 |
| dependency audit                | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38175910464/job/114578144026 |
| Vercel                          | success | https://vercel.com/dealers-drive/dealersdrive-prod-web/AnPH5rMGiM7WryopAJjZfvV1GbA3      |
