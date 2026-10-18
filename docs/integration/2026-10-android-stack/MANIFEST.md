# Android stack integration manifest — 2026-10

Durable record of the sequential review → reconcile → squash-merge campaign for
PR #279 and the F099–F112 Android stack. Kept on its own branch so it never
appears in a feature PR's diff.

## A. Baseline (recorded 2026-10-18, before any merge)

| Item | Value | Evidence |
| --- | --- | --- |
| `main` | `a969dc2` (#311 branding) | `git rev-parse origin/main` |
| Deployed API revision | **not directly observable from the agent sandbox** — the egress proxy refuses `api.dealers-drive.com` (CONNECT 403). Production is assumed to run `main` or older. | `curl https://api.dealers-drive.com/health/ready` → proxy 403 |
| Merge policy | squash only (per owner) | — |
| Branch protection | ≥1 approval, required checks, `strict: true`, `enforce_admins: false` | `docs/project/git-strategy.md` §Branch protection; #311 merged with 0 reviews |
| CODEOWNERS | none | `.github/` listing |

### Can a merge to `main` deploy or mutate production?

| Path | Trigger | Effect on a push to `main` today |
| --- | --- | --- |
| `release.yml` | `push: main` | Builds API + migrator images and **discards** them. AWS assume-role / ECR login steps were `skipped` on run 38563848210 (`a969dc2`), so `vars.AWS_DEPLOY_ENABLED != 'true'`. `deploy-dev` job is commented out. |
| `_deploy.yml` | `workflow_call` only | Not called by any active job. |
| `promote.yml` | `workflow_dispatch` only | Manual, human-approved environment. |
| `ci.yml` | `pull_request: [main]` | No deploy. |
| `security.yml` | PR/push main/schedule | Scans only. |
| Vercel | Git integration | `apps/web/vercel.json` → `git.deploymentEnabled.main: false`; PR previews only. |
| EAS | none on `main` | F108 adds `android.yml`: `pull_request` only, local Gradle compile with a generated validation key, no EAS build/submit/update. |
| Migrations | only via `promote.yml`/migrator image | Never run by a merge. |

**Conclusion:** a squash merge to `main` builds throwaway images and nothing
else. No production deploy, migration, or store submission is triggered.

### CI coverage gap in the stack

`ci.yml` and `security.yml` run only on `pull_request` into `main`. #312–#325
target their parent branches, so **none of them has ever had the main CI
suite**. Each one gets it only after being retargeted to `main` and receiving a
push (base changes alone do not fire `pull_request`).

## B. Stack inventory (conventional dependent chain, not a native GitHub stack)

Every parent head is an ancestor of its child head (verified with
`git merge-base`).

| # | PR | F | Head branch | Head (orig) | Base (orig) | Incremental size | Draft |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | #279 | legal | `feature/legal-compliance-and-consent-v1` | `6180a4b` | `main@a969dc2` | 169 files +7293/−278 | yes |
| 2 | #312 | F099 | `feat/f099-mobile-foundation` | `ba2f30c` | `6180a4b` | 69 files +10121/−414 | yes |
| 3 | #313 | F100 | `feat/f100-mobile-auth-backend` | `8ec6b2d` | `ba2f30c` | 49 files +1779/−128 | yes |
| 4 | #314 | F101 | `feat/f101-mobile-auth-ui` | `7046f54` | `8ec6b2d` | 37 files +1748/−89 | yes |
| 5 | #315 | F102 | `feat/f102-mobile-cars-search-gallery` | `dab6e7a` | `7046f54` | 35 files +2061/−231 | yes |
| 6 | #316 | F103 | `feat/f103-mobile-home-dealers` | `b4357a3` | `dab6e7a` | 30 files +1566/−123 | yes |
| 7 | #317 | F104 | `feat/f104-mobile-saved-account` | `1f0d258` | `b4357a3` | 36 files +1177/−57 | yes |
| 8 | #318 | F105 | `feat/f105-mobile-consent-enquiries` | `1b310ec` | `1f0d258` | 41 files +1740/−138 | yes |
| 9 | #319 | F106 | `feat/f106-mobile-support` | `18245c5` | `1b310ec` | 50 files +1911/−311 | yes |
| 10 | #320 | F107 | `feat/f107-mobile-account-deletion` | `9a77425` | `18245c5` | 92 files +2989/−64 | yes |
| 11 | #321 | F108 | `feat/f108-mobile-release-hardening` | `945856f` | `9a77425` | 73 files +2599/−324 | yes |
| 12 | #322 | F109 (UI/UX 1) | `feat/f109-mobile-ux-foundation` | `39edbf8` | `945856f` | 55 files +1217/−61 | yes |
| 13 | #323 | F110 (UI/UX 2) | `feat/f110-mobile-discovery-search` | `33f697b` | `39edbf8` | 51 files +2081/−550 | yes |
| 14 | #324 | F111 (UI/UX 3) | `feat/f111-mobile-customer-journeys` | `2756c9a` | `33f697b` | 77 files +2299/−378 | yes |
| 15 | #325 | F112 (UI/UX 4) | `feat/f112-mobile-ux-hardening` | `332a8e5` | `2756c9a` | 107 files +850/−47 | yes |

## C. Reconciliation procedure (no force-push)

CLAUDE.md forbids force-pushing and history rewriting, so descendants are not
rebased. After PR N squash-merges as commit `S`:

1. Record the recovery ref `pre-reconcile/<branch>` = old head SHA (here).
2. Check that `git diff <PR N old head> S` is empty, i.e. the squash tree equals the reviewed head tree.
3. On PR N+1's branch: `git merge --no-ff origin/main`. The squash's changes are already in the branch's own history, so this merge resolves trivially.
4. **Patch-equivalence gate:** `git diff origin/main <new head>` must equal `git diff <PR N old head> <PR N+1 old head>` byte for byte (compared with `diff`). If it differs, stop.
5. Retarget the PR base to `main`, then push the merge commit. The push fires `pull_request: synchronize`, so CI runs against `main`.

## D. Per-PR log

(filled as each PR is processed)
