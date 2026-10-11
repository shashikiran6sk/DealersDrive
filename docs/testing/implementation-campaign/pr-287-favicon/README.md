# #287 — browser favicon lettering · independent review

PR: [#287](https://github.com/shashikiran6sk/DealersDrive/pull/287) ·
branch `feat/dd-favicon-sizing` · base `main`

This directory is the **independent review-and-merge campaign** record for
#287. The original author's evidence is preserved, unmodified, in
[`../pr-01-favicon`](../pr-01-favicon).

| SHA                  | Value                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `main` at review     | `d423db1caf9212dab51ee938187234a4660e4f5b` (includes #290, merged by the owner before review) |
| Original PR head     | `6bc012858d389a113790e8c9aee6f196f333de86` (based on `5ce6df5`, one commit behind `main`)     |
| Reconciled (merge)   | `0f34066` — `main` merged in, no conflicts                                                    |
| Final validated head | `ee367df` — scope correction                                                                  |

## Review findings

| Sev | Finding                                                                                                                                                                                                                                                        | Resolution                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| P2  | `ci.yml` and `security.yml` `pull_request.branches` extended with ten transient stacked branch names. Would land permanently on `main`; unnecessary once each PR is reconciled onto `main` before review; out of scope for a favicon PR.                       | Fixed in `ee367df`: both workflows restored byte-for-byte to main.                 |
| P3  | `docs/project/implementation-campaign.md` — a campaign status log in product docs (states "All remain unmerged", a baseline SHA). Goes stale on the first merge; CLAUDE.md §8 forbids progress prose; campaign records belong on `testing_evidence`.           | Removed in `ee367df`; preserved here as `original-implementation-campaign-doc.md`. |
| P3  | `AGENTS.md` — Turborepo-generated agent-guidance block, unrelated to the change. Turbo re-creates it untracked when an agent runs; that is local noise, not a reason to commit it.                                                                             | Removed in `ee367df`.                                                              |
| P3  | `next/font/local` preloads the full 53,804-byte variable font where `next/font/google` preloaded only the Latin subset — roughly +30 KB on a cold first load. Accepted: it removes a build-time dependency on Google Fonts that failed a Vercel preview build. | Not changed. Noted.                                                                |
| P3  | 16 px ICO frame: the smaller glyph's vertical strokes fall on half pixels and render softer. Still legible.                                                                                                                                                    | Not changed. Owner UAT on a real tab.                                              |
| —   | PR was `behind` `main` (strict protection would block merge).                                                                                                                                                                                                  | `main` merged in (`0f34066`).                                                      |

No P0 or P1 findings. No auth, API, schema, migration or environment change.

## What the PR now contains (`git diff origin/main...ee367df`)

`favicon.ico`, `icon.png` (regenerated), `scripts/generate-favicon.mjs`,
`apps/web/src/lib/fonts.ts` + bundled `manrope-variable.woff2`, `OFL.txt`,
`README.md`, two test mocks switched to `next/font/local`, and a `waitFor` around
an existing enquiry scroll assertion. 10 files, +165 / −7.

## Executed checks (local, Node 24.21.0, PostgreSQL 16.15)

Run against the merged tree `0f34066`; `ee367df` differs only by removing
workflow/doc files, and lint/typecheck were re-run on it.

| Check                                         | Result                                                                                    | Log                                          |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------- |
| `pnpm install --frozen-lockfile`              | PASS                                                                                      | —                                            |
| `pnpm lint` (prettier, eslint, docs:check)    | PASS on `0f34066` and `ee367df`                                                           | `logs/lint-typecheck-*.txt`                  |
| `pnpm typecheck`                              | PASS on `0f34066` and `ee367df`                                                           | `logs/lint-typecheck-*.txt`                  |
| `pnpm test` — contracts                       | 427 / 427 PASS                                                                            | `logs/test-summary.txt`                      |
| `pnpm test` — web                             | 1,488 / 1,488 PASS                                                                        | `logs/test-summary.txt`                      |
| `pnpm test` — API (real Postgres, migrations) | 3,030 / 3,030 PASS (3,014 + 16 from #290)                                                 | `logs/test-summary.txt`                      |
| `pnpm build`                                  | PASS (contracts, API, Next production)                                                    | `logs/build.txt`                             |
| Served favicon bytes                          | `/favicon.ico` sha256 `56912ca4…` equals the committed file                               | —                                            |
| Browser (Chromium, `next start`)              | 320/390/768/1280 px: Manrope 400–800 loaded, no failed assets, no overflow                | `browser-results.json`, `screenshots/`       |
| ICO frames                                    | 16/32/48 frames, same order as main; glyph width 76 % → 57 % of tile; corners transparent | `screenshots/ico-frames-before-after-8x.png` |
| Manifest / installed-PWA icons                | Unchanged (`/brand/icon-*.png`); apple-icon unchanged                                     | —                                            |

Initial typecheck failure (`pino-production-repro` not found) was caused by
installing dependencies before merging `main` (#290 added a dependency);
`pnpm install` resolved it. Not a code defect.

## Not verified

- A real browser tab's chrome (headless cannot capture it) and OS/theme favicon
  caching. Owner UAT: hard-refresh and look at the tab in light and dark.
- Production: nothing was deployed. Vercel creates Production deployments for
  `main` commits (one exists for `d423db1`); whether that happens automatically
  on merge could not be confirmed from GitHub.

## CI on final head

All seven checks green on `ee367df` — see `ci.md`.
