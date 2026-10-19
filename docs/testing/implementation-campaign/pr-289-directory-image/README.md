# #289 — shared dealer directory image · independent review

PR: [#289](https://github.com/shashikiran6sk/DealersDrive/pull/289) · branch
`feat/standard-dealer-directory-image` · base `main`. Original author evidence:
[`../pr-03-directory-image`](../pr-03-directory-image).

| SHA                  | Value                                                      |
| -------------------- | ---------------------------------------------------------- |
| `main` at review     | `19c1100` (#288 squash)                                    |
| Original PR head     | `451ac4e` (parent in stack: `9ad0c9e`)                     |
| Reconciled           | `42f216e` — merge commit, tree = main + `9ad0c9e..451ac4e` |
| Final validated head | `22dbc37`                                                  |

## Reconciliation

A plain merge of `main` would conflict: `main` carries the reviewed #288
(claim fix, trimmed doc) and this branch the original. `42f216e` is a merge
commit (parents `451ac4e`, `19c1100`) whose tree is `main` plus exactly this
PR's increment; `diff(main..42f216e) == diff(9ad0c9e..451ac4e)` byte for byte.
Fast-forward push, no history rewrite.

## Review

- Directory API: every card's `coverUrl` is the shared
  `/brand/dealer-directory-cover.svg`; the per-page yard-media query is gone (one
  query fewer, no per-dealer asset). Detail page keeps ready yard media only.
- Web card ignores `coverUrl` and always renders the shared asset (stale cache
  safe); "YARD VERIFIED" pill removed (it was awarded for photo presence).
- Yard photo no longer required by completeness/submission; approval guard,
  documents and permissions unchanged. Upload/remove behaviour unchanged.
- `turbo.json`: typecheck no longer caches `dist/**` — a no-emit task restoring
  a stale API build was a real cache-correctness bug.

| Sev      | Finding                                                                                                                       | Resolution                                        |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| P3       | Design doc ended with campaign status.                                                                                        | Removed (`22dbc37`).                              |
| P3       | The same long `alt` is announced on every card; a decorative image would normally use `alt=""`. Not misleading, just verbose. | Noted.                                            |
| P3       | `DealerCardCover` keeps an unused `dealer` prop.                                                                              | Noted.                                            |
| — / #297 | Cards still say "VERIFIED DEALER" (DTO hardcodes `isVerified: true`) and the page heading claims identity/GST verification.   | Out of scope; #297's job. Tracked for its review. |

No P0/P1/P2 findings.

## Executed checks (Node 24.21.0, PostgreSQL 16.15)

| Check                                                                       | Result                                                                                                                                      |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| lint + typecheck                                                            | PASS on `22dbc37`                                                                                                                           |
| tests                                                                       | contracts 428/428 · web 1,489/1,489 · API 3,060/3,060                                                                                       |
| build                                                                       | PASS                                                                                                                                        |
| Real stack (built API :4000 + `next start` :3000, migrated + dev-seeded DB) | `/v1/dealers` returns the shared cover for every card                                                                                       |
| Browser `/dealers` at 320/390/768/1280                                      | 24/24 cards render the shared SVG, all loaded; no "YARD VERIFIED"; no overflow; no failed requests — `browser-results.json`, `screenshots/` |

Not exercised: a dealer with an uploaded, ready yard photo on the detail page
(seed has no photographs); covered by the unit/integration suites.

## CI on `22dbc37`

| Check                           | Result  | Run                                                                                      |
| ------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| Vercel Preview Comments         | success | https://github.com/shashikiran6sk/DealersDrive/runs/114566596840                         |
| semgrep                         | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38172060574/job/114566539168 |
| gitleaks                        | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38172060574/job/114566538964 |
| lint · typecheck · test · build | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38172060431/job/114566538819 |
| terraform fmt / validate        | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38172060431/job/114566538730 |
| dependency audit                | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38172060431/job/114566538605 |
| Vercel                          | success | https://vercel.com/dealers-drive/dealersdrive-prod-web/Bm8GERpKPmNoNs1Y1mfxgcEi4KZm      |
