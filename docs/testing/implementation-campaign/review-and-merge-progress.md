# Review-and-merge campaign — progress

The live state of the independent review, reconciliation and sequential merge
of the eleven stacked PRs, the canonical vehicle-make PR, and the Draft #299
revision. Updated at each checkpoint. Nothing is marked complete before its
merge has been verified on `main`.

## Ground rules in force

- One owner approval per merge. No blanket approval.
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

| #   | PR   | Feature                 | Original head | Final tested head | CI (final) | Merge SHA | State                                   |
| --- | ---- | ----------------------- | ------------- | ----------------- | ---------- | --------- | --------------------------------------- |
| 1   | #287 | Favicon                 | `6bc0128`     | `ee367df`         | green      | `5d5b5e6` | Merged, main verified (tree == ee367df) |
| 2   | #288 | Email uniqueness        | `9ad0c9e`     | `5b6be13`         | green      | `19c1100` | Merged, main verified |
| 3   | #289 | Directory image         | `451ac4e`     | `22dbc37`         | green      | `e8f0e55` | Merged, main verified |
| 4   | #291 | Service locations       | `aaceb01`     | `4f11619`         | green      | `0d3d201` | Merged, main verified |
| 5   | #292 | Optional tagline        | `465a5cd`     | `cef8c0b`         | green      | `f2f4d7b` | Merged, main verified |
| 6   | #293 | Admin OTP               | `e481bb0`     | `e9e8939`         | green      | —         | Reviewed; owner defect fixed; merging (real MSG91 UAT outstanding) |
| 7   | #294 | Mobile admin            | `a17b4a4`     | —                 | —          | —         | Pending                                 |
| 8   | #295 | Ticket messaging        | `98a5b78`     | —                 | —          | —         | Pending                                 |
| 9   | #296 | Mobile sidebar          | `cefed41`     | —                 | —          | —         | Pending                                 |
| 10  | #297 | Dealer verification     | `23c47d1`     | —                 | —          | —         | Pending                                 |
| 11  | #298 | Optional GSTIN          | `b500bd5`     | —                 | —          | —         | Pending                                 |
| —   | new  | Canonical vehicle makes | —             | —                 | —          | —         | Not started                             |
| —   | #299 | Progressive onboarding  | `f563188`     | —                 | —          | N/A       | Draft, untouched                        |

Stack ancestry at start: linear; each branch contains its parent. Migrations
introduced per PR: #288 1, #291 2, #292 1, #293 2, #295 1, #297 1, #298 1.

## Owner approvals

- 2026-10-11: owner approved #287, then granted session-scoped authority to merge every stacked PR (admin bypass) after a thorough review and green CI on its final head. #299 remains excluded.

## Next action

Owner merge decision on #287. After the merge: verify `main`, then merge the
new `main` into `fix/dealer-email-uniqueness`, retarget #288 to `main`, confirm
its three-dot diff is #288-only, and begin its review.
