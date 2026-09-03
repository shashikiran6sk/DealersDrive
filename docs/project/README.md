# Project Reorganisation — Phase 1 Audit

Read-only audit of the existing Dealers-Drive repository, produced before any
reorganisation work. **Nothing in the application was modified to produce it.**

| Document                                         | What it answers                                                                                                   |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| [`feature-map.md`](./feature-map.md)             | The **decision log (D1–D3)**, then what features exist, what each one owns, in what order they can be rebuilt     |
| [`component-map.md`](./component-map.md)         | Every UI component, its props, states, consumers, coupling and sandbox priority                                   |
| [`component-sandbox.md`](./component-sandbox.md) | How the feature-integrated component sandbox should be built and run                                              |
| [`git-strategy.md`](./git-strategy.md)           | Git analysis, the `chore: initialize project` definition, risk ranking, and the mandatory future feature workflow |

## Status

**Phase 1 (audit) — complete, revised once. Awaiting human review.**

Nothing has been branched, committed, pushed, refactored or scaffolded. The
sandbox described in `component-sandbox.md` does **not** exist yet and must not
be built until Phase 1 is approved.

### Review decisions already folded in

|        | Decision                                                                                                                                          | Where it lands                                                                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | The seeded database catalogue is **removed** — vehicle details come from the external RC lookup or manual entry                                   | `feature-map.md` §D1; the convergence gate in `git-strategy.md` §5 is no longer _"the diff must be empty"_; facet normalisation moves to write time at F060/F076 |
| **D2** | Feature breakdown went from 27 to **97 features across 14 tiers** — dealer onboarding and document verification alone became F036–F045            | all four documents renumbered                                                                                                                                    |
| **D3** | **CI/CD moved to Tier 3** (F021–F025), immediately after F018 _Dealer sign-in with Google OAuth_ — the first commit at which a person can sign in | `feature-map.md` Tier 3; the PR sequence in `git-strategy.md` §5                                                                                                 |

## Audit method

Everything below was derived from the repository at commit `f05acdc`, by
reading source, configuration, the Prisma schema, the route table, the CI
workflows and the coverage reports. Where a claim could not be verified from
the repository (branch protection, for example), it is marked as such rather
than guessed.

## Headline numbers

| Measure                                             | Value                             |
| --------------------------------------------------- | --------------------------------- |
| Application source (`apps/*/src`, `packages/*/src`) | ~38,100 lines                     |
| Test source (`apps/*/tests`, `packages/*/tests`)    | ~34,400 lines                     |
| Prisma schema + seed                                | ~5,350 lines                      |
| Documentation (`docs/`, `README.md`, `CONTEXT.md`)  | ~29,600 lines                     |
| API modules                                         | 12                                |
| Prisma models / enums                               | 27 / 27                           |
| HTTP endpoints                                      | ~80                               |
| Next.js routes (pages + BFF)                        | 32 + 9                            |
| React components (exported)                         | 65                                |
| Features identified (post-D2)                       | **97 across 14 tiers**            |
| API test coverage (lines)                           | **97.74 %**                       |
| Contracts test coverage (lines)                     | **100 %**                         |
| Web test coverage (lines)                           | **13.83 %**                       |
| Web component tests                                 | **1 of 65 components** (`Button`) |

That last pair is the finding that justifies the whole exercise: the backend is
rigorously tested, and the UI layer is essentially untested. The sandbox is the
lever that fixes it.
