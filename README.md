# Dealers-Drive — project documents

This is the `docs` branch. It holds the history and process documents of
Dealers-Drive: how the product was planned, built, reviewed and certified.
None of it is needed to build or run the code, so it lives here rather than on
`main`.

`main` keeps what describes the code as it is today — `AGENTS.md`, the
`README.md`, `docs/code/**` (the reasoning behind each source file),
`docs/DESIGN-SPEC.md`, `docs/errors.md`, `docs/observability.md`,
`docs/seo.md` and `docs/legal/**`.

## Reading these files from a checkout of `main`

```bash
git fetch origin docs
git show origin/docs:CONTEXT.md
git show origin/docs:docs/project/feature-map.md
git ls-tree -r --name-only origin/docs -- docs/qa
```

## What is here

| Path                                                                                           | What it is                                                                                                                                            |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`CONTEXT.md`](CONTEXT.md)                                                                     | The engineering log: gotchas, constraints and decisions discovered while building (§7a–§8e). Read it before a refactor.                               |
| [`docs/project/`](docs/project)                                                                | The plan: feature map (F001–F097), component map, sandbox design, git strategy, progress, and per-feature design notes                                |
| [`docs/qa/production-release/`](docs/qa/production-release)                                    | The pre-production certification campaign: test plan, registry, defect register, evidence, GO/NO-GO                                                   |
| [`docs/qa/release-115ac26a/`](docs/qa/release-115ac26a)                                        | The release-candidate certification of `115ac26a`: the full replay, the retest of every baseline defect, the new-feature campaigns and the GO verdict |
| [`docs/screens/`](docs/screens)                                                                | The original screen designs, one folder per page                                                                                                      |
| [`docs/Dealers-Drive-UI/`](docs/Dealers-Drive-UI)                                              | The original UI design-system reference                                                                                                               |
| [`docs/evidence/`](docs/evidence)                                                              | Screenshots and captures attached to individual features                                                                                              |
| [`docs/testing/`](docs/testing)                                                                | Browser test output for individual features (legal v1, dealer publication)                                                                            |
| [`docs/branding-migration.md`](docs/branding-migration.md)                                     | The brand-asset migration record                                                                                                                      |
| [`docs/original-spec/`](docs/original-spec)                                                    | The five specification documents the product was first built from (architecture, API spec, deployment, onboarding, the first agent manual)            |
| [`docs/history/CLAUDE-reconstruction-manual.md`](docs/history/CLAUDE-reconstruction-manual.md) | The operating manual used while the codebase was re-delivered feature by feature; `AGENTS.md` on `main` replaced it                                   |

## Updating this branch

Push documentation changes here directly or through a pull request against
`docs`. A code change on `main` never needs to edit this branch in the same PR:
the reasoning that has to stay true alongside the code goes in `docs/code/**`
on `main`.
