---
name: read-project-history
description: Read Dealers-Drive's history and process documents from the docs branch without switching branch — the engineering log (CONTEXT.md), the feature map and progress, the component map, the pre-production certification and defect register, the original specifications and screen designs. Use when you need why a decision was made, what an F-number contains, whether a feature is built, or what the certification found.
---

# Read the project history on the `docs` branch

`main` carries the code and the documents that describe it as it is
(`AGENTS.md`, `README.md`, `docs/code/**`, `docs/DESIGN-SPEC.md`, …). Everything
about how it was planned, built and certified is on the `docs` branch.

## Reading without switching branch

```bash
git fetch origin docs
git ls-tree -r --name-only origin/docs              # what is there
git show origin/docs:README.md                      # the index
git show origin/docs:CONTEXT.md                     # the engineering log
git grep -n "R71" origin/docs -- CONTEXT.md docs/project
```

On GitHub: https://github.com/shashikiran6sk/DealersDrive/tree/docs

## Where to look

| Question                                            | On the `docs` branch                                                                                       |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Why does the code do this surprising thing?         | `origin/docs:CONTEXT.md` (§7a–§8e), then the `docs/code` page on `main`                                    |
| What does F0xx contain, and what does it depend on? | `origin/docs:docs/project/feature-map.md`                                                                  |
| Is a feature built?                                 | `origin/docs:docs/project/progress.md`, then `git log --grep F0xx` on `main`                               |
| What are a component's props, states and consumers? | `origin/docs:docs/project/component-map.md`, then `apps/sandbox/src/registry.ts` on `main`                 |
| What did a feature's design note decide?            | `origin/docs:docs/project/<feature>.md`                                                                    |
| What did the production certification find?         | `origin/docs:docs/qa/production-release/` — `DEFECT-REGISTER.md`, `FINAL-CERTIFICATION.md`, `TEST-PLAN.md` |
| What was the original architecture or API spec?     | `origin/docs:docs/original-spec/`                                                                          |
| What did a screen look like in the design?          | `origin/docs:docs/screens/<Page>/`                                                                         |

Ticket prefixes you will meet: **F0xx** (feature-map features), **R0xx**
(revisions after a feature landed), **D1–D7** (decisions in the feature map),
**BUG-1xx** and **UPD-n** (certification defects and product decisions).

## Changing these documents

Never in the same PR as a code change to `main`. Open a separate PR against
`docs` (branch from `origin/docs`). The `docs` branch has its own `README.md`
index — add new documents to it.
