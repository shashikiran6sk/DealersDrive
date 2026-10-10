# Final GitHub CI status

Observed 8 October 2026, 06:58 UTC for implementation `4c1bb0a2d98d70353f2295d46ca7ebbab88b2495`.

[PR #279](https://github.com/shashikiran6sk/DealersDrive/pull/279) is **open, draft, unmerged**; auto-merge is disabled. Base is the supplied main commit `2a1845abcab9a6cf8b9fc3658cb5c92bf3c92566`.

| Check                                                                       | Final result | Run                                                                                     |
| --------------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------- |
| Format / lint / docs references / typecheck / full tests / production build | SUCCESS      | [CI 499](https://github.com/shashikiran6sk/DealersDrive/actions/runs/37739762617)       |
| Dependency audit                                                            | SUCCESS      | CI 499                                                                                  |
| Terraform fmt / init without backend / validate                             | SUCCESS      | CI 499                                                                                  |
| Semgrep                                                                     | SUCCESS      | [Security 697](https://github.com/shashikiran6sk/DealersDrive/actions/runs/37739762640) |
| Gitleaks                                                                    | SUCCESS      | Security 697                                                                            |
| Vercel commit check                                                         | SUCCESS      | GitHub commit status                                                                    |

Earlier CI runs were superseded by the publication checklist and final lead-email disclosure fix. The results above apply to the exact final source SHA, not an earlier successful revision. Checks were neither bypassed nor removed.

Final local results: 3,037 API tests, 1,485 web tests and 429 contracts tests pass (4,951 distinct full-suite tests). API coverage: statements 95.88%, branches 90.37%, functions 97.97%, lines 96.98%. All configured coverage gates pass. Ten focused legal PostgreSQL integration cases include the final legacy-dealer email safeguard; focused/config tests overlap the full totals.

The screenshots and legal review packet are linked from [the evidence README](README.md). Review status remains legally BLOCKED for production publication: mandatory business facts, monitored appointed contacts, operations and exact-text owner/Indian counsel sign-off are unresolved. No production database migration, merge or production release was performed.
