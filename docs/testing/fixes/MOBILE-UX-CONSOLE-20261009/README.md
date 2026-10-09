# Mobile UX corrections and dealer console cleanup

This document records the original pre-merge readiness checkpoint. The subsequent enquiry/address fixes and the owner-authorized sequential merges are recorded in [the follow-up evidence](follow-up-enquiry-address/README.md) and [the final merge report](MERGE-REPORT.md).

[Full A–G readiness report](READINESS.md) · [Mobile PR #285](https://github.com/shashikiran6sk/DealersDrive/pull/285) · [Console PR #286](https://github.com/shashikiran6sk/DealersDrive/pull/286)

This folder follows the existing `testing_evidence` archive convention. It is never merged, deployed or used as a product branch base. Permanent source, regression tests and component documentation remain in the product PRs. Earlier archive artifacts remain available in branch history.

| Source                          | Commit                                     |
| ------------------------------- | ------------------------------------------ |
| Main / independent console base | `2a1845abcab9a6cf8b9fc3658cb5c92bf3c92566` |
| Initial mobile                  | `2b5561b2e36e175fee97e2b65fec28b9637e260e` |
| Final mobile                    | `fb48fa656ab5146bb638a870e9e74a686b34d775` |
| Final console                   | `382bcc9b74604d2f7645a816b4996a83e972da43` |
| Local-only final integration    | `6a825fc0e95e438854193bfb3c5a570c099bd6ea` |

Both product PRs have six passing exact-head CI/Security checks and remain open and unmerged. Full local suites pass: mobile 4,919, console 4,922 and integration 4,928 tests. Final formatting, lint, docs, types and production builds pass independently and combined.

| Evidence                                                                        | Contents                                                                                  |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `mobile-before/`, `mobile-after/`                                               | 330 matched page cases for the seven corrections; actual drawer before included           |
| `desktop-mobile-correction-comparison.json`                                     | 66 identical desktop page pairs                                                           |
| `mobile-components/`                                                            | Final independent mobile matrix: 516 passed cases                                         |
| `mobile-interactions/`, `mobile-extra-interactions-a.json`                      | 91 correction/filter/history/landscape assertions                                         |
| `filter-first-tap-before/first-tap.mp4`, `filter-first-tap-after/first-tap.mp4` | Native recordings: same 76 cars, immediate and persistent selection fixed                 |
| `gallery-short-before/`, `gallery-short-after/`                                 | Six short-height failures before; all 36 gallery cases pass afterward                     |
| `gallery-desktop-comparison.json`                                               | Six identical desktop gallery pairs                                                       |
| `console-before/`, `console-after/`                                             | 50 affected route cases across all widths                                                 |
| `console-components/`, `console-edge-states/`                                   | 60 final component cases and 50 long-name/keyboard/200% text assertions                   |
| `console-authenticated/`                                                        | Real local OTP, public workspace entry, avatar before/after and complete desktop logout   |
| `console-baseline-overflow.json`                                                | Inherited main chart overflow at 320px; new cards fit and integration fixes the panel     |
| `integrated-pages/`                                                             | 330 combined cases, no content overflow; redirects recorded separately                    |
| `integrated-components/`                                                        | Full 570-case matrix plus affected gallery rerun: 576 unique cases with commit provenance |
| `integrated-authenticated/`                                                     | 28 real-session assertions, mobile logout, saved cars and short-height enquiry submission |
| `integrated-mobile-interactions/`, `integrated-extra-interactions.json`         | All 91 correction and filter assertions pass together                                     |
| `integrated-interactions/`, `integrated-edge-states/`, `integrated-gallery/`    | 85 metric, 50 text/menu and six native gallery assertions                                 |
| `git-preservation-audit.json`, `ci-exact-head.json`                             | Source/branch preservation and exact-head checks                                          |
| `logs/`, `harness/`                                                             | Successful checks, reproduced regressions, resource retry logs and browser harnesses      |

Widths: **320, 360, 375, 390, 430, 440, 768, 1024, 1280, 1440**. Short-height, landscape and 200% computed text-size fixtures supplement them. APIs, databases and fake OTP are local and isolated, with jobs disabled. Session values are not recorded. Real-device keyboards/safe-area hardware, production SMS and real Google OAuth were not run.

Merge #285 first only after owner approval, then update #286 from main and resolve the three documented text conflicts before separate approval. Main does not contain the mobile drawer: standalone console mobile logout depends on #285's shared navigation host. No PR merge is performed by this campaign.
