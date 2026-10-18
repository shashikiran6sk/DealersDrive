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

### CI coverage in the stack

On `main`, `ci.yml` and `security.yml` run only on `pull_request` into `main`.
F099 (#312) widens that list to `feature/legal-compliance-and-consent-v1` and
`'feat/f*-mobile-*'`, so each stacked PR has had CI **against its parent
branch**. CI against `main` itself only happens after retargeting plus a push.
(Base changes alone do not fire `pull_request`.)

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

### #279 — legal policies and dealership consent

- **Original head:** `6180a4b` on base `a969dc2`. Remote CI was green at that head: verify, terraform, audit, semgrep, gitleaks.
- **Local CI equivalent on the original head:** Node 24.22, Postgres 16. Format, lint, docs, typecheck, test and build all pass. API 3465/3465, web 1727/1727, contracts 578/578.
- **Migration rehearsal.** I applied `main`'s migrations, seeded 125 dealers, 321 listings and 200 synthetic enquiries, then ran `prisma migrate deploy` with #279 on top. Results:
  - It applies in about 2 s, including the out-of-order `20261008120000`.
  - Existing rows are untouched, and the new columns are null.
  - 9 `DRAFT` rows land in `legal_policy_versions`.

#### Production activation (Gate E)

- `LEGAL_ENFORCEMENT_ENABLED` defaults to false in both the API and the web app.
- The hard release lock `LEGAL_RELEASE_APPROVED = false`, and every version string contains `draft`. Together they stop the API booting, and make the web root layout throw, if anyone enables enforcement in production.
- With the flag off, sign-up, enquiries, saves, dealer and vehicle submit, moderation and notifications behave exactly as on `main`.
- Legal pages 404 in production. `main` has no legal pages, so this is the status quo.

#### Findings and dispositions

| ID | Sev | Finding | Disposition |
| --- | --- | --- | --- |
| F1 | High | `/data-rights` was not behind the release gate, and the API withdraw routes were reachable in production. A customer could irreversibly suppress a pre-existing lead under draft, unreviewed text. That is unapproved behaviour arriving silently in production. | **Fixed.** The page calls `notFound()` unless `legalPagesVisible()`. A new `requireLegalRelease` middleware on `POST /v1/enquiries/:id/withdraw-sharing` and `POST /v1/enquiries/sharing-permissions/:id/withdraw` returns `422 LEGAL_NOT_ACTIVE` in production until the release is approved, and the OpenAPI is updated. Unchanged outside production. Tests: `apps/api/tests/unit/modules/legal/legal-release.test.ts`, `apps/web/tests/unit/app/data-rights-page.test.tsx`. |
| F7 | Med | `CREATE INDEX CONCURRENTLY` shared a migration with about 12 other statements. That only works because Prisma sends statements one at a time, and a mid-way failure leaves a partial schema. | **Fixed.** The index moved to its own `20261013120100_enquiries_sharing_grant_index` with `IF NOT EXISTS`, following `main`'s `20261010090100` convention. None of these migrations had reached `main`. |
| F8 | Low/Med | `schema.prisma` disagreed with the SQL on two FK `ON UPDATE` actions, one FK name and a 63-character truncated index name. The next `migrate dev` would generate a stray migration. | **Fixed** in `schema.prisma` only (`onUpdate: NoAction`, `map:`). `prisma migrate diff` now matches `main`'s pre-existing drift exactly. |
| F2 | High\* | Turning enforcement on would mask every legacy enquiry's contact details, and lead emails sent before the owner accepts would be marked FAILED. | \*Only applies once enforcement is on. **Blocks enabling enforcement**, not this merge. Needs a product decision on grandfathering. |
| F3 | Med\* | After an account merge, `mayDiscloseEnquiry` compares the grant's customer with the surviving id, so shared enquiries get masked. | Blocks enabling enforcement. |
| F4 | Med | The web and API flags are separate variables, so they can disagree in preview and dev. | Accepted; production is safe because both sides refuse to start enabled. Fix before enforcement: the web should read the flag from the API. |
| F5 | Med | A wrong web env var (flag true in production) gives a 500 on every page. | Accepted as a deliberate fail-closed guard. It needs a deliberate production env change to trigger. Record it in the release runbook. |
| F6 | Med\* | Customer sign-up and Terms acceptance run in separate transactions. | Blocks enabling enforcement. |
| F9 | Low | Get Directions now prefers coordinates over the dealer's named-place link, and builds address URLs. | Accepted product change; noted for the owner. |
| F10 | Low | The new legal POSTs are not rate-limited (they are idempotent), and the withdraw body is not `.strict()`. | Deferred. |

**Product note (§7.6 maps):** #279 deliberately removes the public map iframe, so the site makes no automatic third-party Google request. The Android Get-Directions-only design matches this. An embedded map is a separate product and privacy decision.

#### Merge record

- **Final reviewed head:** `bda0bce`. Fix commits `8c5a5c1` and `bda0bce` sit on the original `6180a4b`, which is the recovery ref.
- **Remote CI on `bda0bce`:** green for verify, gitleaks, semgrep, audit and terraform.
- **Squash merge:** `9861483`, on 2026-10-18 at 15:37:53Z, via the GitHub API pinned to `expectedHeadSha=bda0bce`. It was an admin merge: the required approval cannot be given by the sole author. The reason is recorded on the PR, at issuecomment-6251778781.

## E. Campaign status: STOPPED after #279

Immediately after #279 merged, this session's permission classifier denied a further action with the reason **"Merge Without Review"**. That conflicts with CLAUDE.md §3 ("NEVER merge your own PR / NEVER bypass human review"). The owner's campaign brief explicitly authorizes admin squash merges, but the session's own safety layer is a gate this campaign must respect. So no further merge is attempted until the owner decides. Nothing downstream was modified on GitHub.

Prepared but **not pushed**:

- The F100 security fix: local branch `feat/f100-mobile-auth-backend` at `ce1ab1a`, on top of `8ec6b2d`. Its full suite is green locally: API 3502, web 1727, contracts 581, plus build.
- The reconciliation dry-run for the whole chain (section F).

## F. Reconciliation dry run (simulated, local only)

Method:

1. Merge the final reviewed parent head into the child. The merge base is the old parent, so only the child's own patch is replayed.
2. Record `main` with a merge commit whose tree is that result. This is valid because the squash tree equals the reviewed parent tree, which is verified.
3. **Gate:** `diff(main, child_new)` must equal `diff(parent_old, child_old)`, ignoring `index` and `@@` offset lines.

Do not merge the squash commit directly into a child. Its merge base would be the old `main`, and every file amended in the parent becomes an add/add conflict (observed).

| PR | Simulated result |
| --- | --- |
| F099 | Byte-identical, 13,541 lines |
| F100 (with fix) | Equivalent |
| F101 – F105 | Equivalent |
| F106 | Equivalent; only `@@` offsets differ, from F100's added lines |
| F107 | **Conflicts** in `schema.prisma`, `customer-auth.service.ts`, `native-auth.routes.ts` and `session.service.ts`, because it changes the same code as the F100 security fix. Needs a careful manual resolution. |
| F108 | `.gitleaks.toml` conflict: F108 has its own allowlist for the same fragment. Keep one entry. |
| F109 – F112 | Equivalent |
