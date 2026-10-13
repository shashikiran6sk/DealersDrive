# Review-and-merge campaign — progress

The live state of the independent review, reconciliation and sequential merge
of the eleven stacked PRs, the canonical vehicle-make PR, and the Draft #299
revision. Updated at each checkpoint. Nothing is marked complete before its
merge has been verified on `main`.

## Ground rules in force

- Merges proceed under the owner's session-scoped authority (see Owner approvals): thorough review and green CI on the final head first.
- No force-push, no history rewrite (CLAUDE.md §3). Each next PR is reconciled
  by merging the new `main` into its branch: `main` squash-merges under strict
  up-to-date protection, so the squash tree equals the PR's final head and the
  descendant's three-dot diff reduces to its own work.
- #290 (observability) was already on `main` (`d423db1`) when this campaign
  started. It was merged by the owner and is not part of the stack.
- #299 stays Draft and unmerged.

## Deployment facts (established 2026-10-11)

| Tier | Trigger on merge to `main`                                                                                                                                                                                                                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API  | `release.yml` builds images only. `deploy-dev` is commented out; images are pushed only if `AWS_DEPLOY_ENABLED == 'true'`. Production is `promote.yml`, manual.                                                                                                                                                  |
| Web  | Vercel Git integration. The #287 merge (`5d5b5e6`) produced no Vercel deployment;, project `dealersdrive-prod-web`. `vercel[bot]` created a Production deployment for `d423db1` (#290), none for #285/#286. Auto-deploy-on-merge is **unconfirmed** — the owner must confirm Vercel's production-branch setting. |
| DB   | Migrations run only inside `_deploy.yml` (migrator task), which nothing on `main` currently invokes.                                                                                                                                                                                                             |

Consequence to watch from #288 on: a web-only Vercel deploy of `main` against
an API that has not been promoted, when a PR changes both tiers or a contract.

## Status

| #   | PR   | Feature                 | Original head | Final tested head | CI (final) | Merge SHA | State                                              |
| --- | ---- | ----------------------- | ------------- | ----------------- | ---------- | --------- | -------------------------------------------------- |
| 1   | #287 | Favicon                 | `6bc0128`     | `ee367df`         | green      | `5d5b5e6` | Merged, main verified (tree == ee367df)            |
| 2   | #288 | Email uniqueness        | `9ad0c9e`     | `5b6be13`         | green      | `19c1100` | Merged, main verified                              |
| 3   | #289 | Directory image         | `451ac4e`     | `22dbc37`         | green      | `e8f0e55` | Merged, main verified                              |
| 4   | #291 | Service locations       | `aaceb01`     | `4f11619`         | green      | `0d3d201` | Merged, main verified                              |
| 5   | #292 | Optional tagline        | `465a5cd`     | `cef8c0b`         | green      | `f2f4d7b` | Merged, main verified                              |
| 6   | #293 | Admin OTP               | `e481bb0`     | `e9e8939`         | green      | `367c0b2` | Merged, main verified (real MSG91 UAT outstanding) |
| 7   | #294 | Mobile admin            | `a17b4a4`     | `2c60ca4`         | green      | `210dfc9` | Merged, main verified                              |
| 8   | #295 | Ticket messaging        | `98a5b78`     | `40fdabe`         | green      | `9ea8b70` | Merged, main verified                              |
| 9   | #296 | Mobile sidebar          | `cefed41`     | `1180e1c`         | green      | `2f16932` | Merged, main verified                              |
| 10  | #297 | Dealer verification     | `23c47d1`     | `b5ef50b`         | green      | `91e3533` | Merged, main verified                              |
| 11  | #298 | Optional GSTIN          | `b500bd5`     | `8310fba`         | green      | `6f4f040` | Merged, main verified                              |
| 12  | #300 | Canonical vehicle makes | `92ac922`     | `383a2b0`         | green      | `5a89a9f` | Merged, main verified                              |
| —   | #299 | Progressive onboarding  | `f563188`     | `0e8a6ba`         | local green| N/A       | Draft, revised; not merged (owner instruction)     |

Stack ancestry at start: linear; each branch contains its parent. Migrations
introduced per PR: #288 1, #291 2, #292 1, #293 2, #295 1, #297 1, #298 1.

## Owner approvals

- 2026-10-11: owner approved #287, then granted session-scoped authority to merge every stacked PR (admin bypass) after a thorough review and green CI on its final head. #299 remains excluded.

## Next action

All eleven stacked PRs and #300 (canonical vehicle makes, `5a89a9f`) are merged; regression on `6f4f040` green. Draft #299 revised to `0e8a6ba` (evidence: `pr-299-progressive-onboarding/`); it stays Draft and is not merged. Next: final report.


## #301 — verify-first assisted onboarding (stacked on #299)

- Opened 2026-10-12 at `2366250`; evidence in `pr-301-verify-first-onboarding/`.
- The owner merged #299 and asked for #301 to be merged after CI. `main` merged into the branch at `5e52ed5` (tree identical to `896fbe7`: #299 was squash-merged); `896fbe7` fixed a countdown race found by reproducing an intermittent test under load.
- CI on `5e52ed5`: lint · typecheck · test · build, dependency audit, semgrep, gitleaks, terraform — all success.
- Squash-merged into `main` as `fb0e107` on 2026-10-12.

## #302 — GSTIN on the GST certificate; no GSTIN/PAN fields; no GST note

- Opened 2026-10-12 at `5457533` (main merged in; #301's squash resolved to this branch's side except the countdown fix taken from main).
- CI all success; squash-merged as `4ca3cd5` per the owner's instruction to merge each split PR after green CI.

## #303 — truthful approval emails, /dealer/documents, direct Dealer Verified

- Opened 2026-10-12; evidence in `pr-303-truthful-approval-and-documents/`.
- Browser check found two truth problems, fixed before merge: an empty slot said "Needed to submit" on a live dealership (`0ac27ee`), and the console header labelled every ACTIVE dealership "Verified" (`2e9e2ab`).
- Test-harness fix for a full-suite timeout (other files' outbox backlog drained by the first `drainEmails()`).
- CI on `2e9e2ab`: lint · typecheck · test · build, dependency audit, semgrep, gitleaks, terraform — all success. Squash-merged into `main` as `8f7b754` on 2026-10-12.

## #304 — dealer photos in the hero gallery; shared PhotoGallery; briefer documents page

- Opened 2026-10-13 at `a481a03`; evidence in `pr-304-dealer-hero-gallery/`.
- CI on `a481a03` all success; squash-merged into `main` as `638a618` on 2026-10-13.
