# PR 3 — shared dealer directory image

PR: [#289](https://github.com/shashikiran6sk/DealersDrive/pull/289)
Branch: `feat/standard-dealer-directory-image` · Base: `fix/dealer-email-uniqueness` (#288)
Head: `451ac4ece70833866e53db1b3eba8e6386e2dd79`
OPEN, unmerged, auto-merge disabled. No production deployment.

## Implemented behavior

All directory cards and public directory payloads use one original, brand-neutral
SVG illustration, with honest shared-concept alt text and stable card geometry.
Uploaded yard media is not queried or emitted for directory cards. No S3 copies,
yard-photo deletions or database migrations. Individual dealer yard media,
fullscreen/viewer and existing upload/moderation rules remain. Yard photography
is optional for submission and approval, while required identity/business/private
document gates remain. “Yard Verified” cover claim is removed.

Current storage supports one yard cover, not a multi-photo yard gallery. Existing
vehicle multi-photo galleries remain. Genuine independent dealer verification
belongs to PR 10; this PR does not fabricate it from photos or approval.

## Executed validation

| Category                | Result                              | Evidence                                                                                         |
| ----------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| Formatting/lint/docs    | PASS                                | Pre/post lint logs, clean diff                                                                   |
| Typecheck               | PASS all packages/sandbox           | Pre/post typecheck logs                                                                          |
| Contracts               | PASS — 428                          | Pre/post full suite                                                                              |
| Frontend                | PASS — 1,489                        | Pre/post full suite                                                                              |
| API unit/integration    | PASS — 3,043                        | Real PostgreSQL; pre/post full suite                                                             |
| Full suite              | PASS — 4,960                        | Existing thresholds retained                                                                     |
| API coverage            | PASS 96.97% lines / 90.28% branches | Post test log                                                                                    |
| Production builds       | PASS uncached, after validation     | Pre/post build logs                                                                              |
| Optional-photo approval | PASS                                | Genuine required-document fixture; missing legal/identity fields still block                     |
| Media/privacy           | PASS                                | Upload/moderation/detail regressions; directory does not query private/unready yard media        |
| Browser/public API      | PASS                                | Pre/post `browser-results.json`, identical cover URLs, HTTP 200 SVG, no private primary identity |
| Responsive/navigation   | PASS 320/390/768/1280px             | No overflow, actual card/detail navigation                                                       |
| Required GitHub CI      | PASS final head                     | All required checks, Terraform and preview PASS against this exact head                          |

Actual application screenshots live under `pre-pr/` and `post-pr/`; contacts are
masked. The illustration is an implemented static asset, not a page mockup or
claimed photograph of a dealer. Synthetic local data/providers only, no production
records or credentials. Historical 556-case and real-provider/device UAT not claimed.

## Observed validation corrections

Existing tests expecting mandatory yard photography and yard-photo directory
covers were revised to the approved business behavior, adding a positive approval
without a photo while retaining required-document failures. Unit package checks
initially needed shared-contract build before consuming the new asset constant.

Browser checks exposed a no-emit typecheck cache wrongly claiming `dist/**` as
output: it could restore an old API build. The task now caches build-info only.
Actual emitted directory code was inspected, rebuilt after static checks, and
verified unchanged across cached typecheck before final browser execution.
No check, threshold or branch protection is removed.

## Post-PR quality record

Migrations: none. API: directory shared cover URL; optional presentation gate.
UI: shared cover, honest alt text, removed yard claim, optional uploader copy.
Files: `changed-files.txt` (captured with final GitHub record).
Final local failures: zero. Final CI: all required checks PASS on the head above; exact run SHA/URLs in `ci-run.json` and `security-run.json`.
MERGED: NO. Next PR: service locations, only after final-SHA gates pass.

Owner UAT: compare cards with/without photos; all show the same illustration.
Check approved detail media and viewer, private/unready media exclusion, filters,
pagination/navigation and mobile layout. Submit/approve a synthetic application
with valid required evidence and no yard photo; identity requirements must remain.
