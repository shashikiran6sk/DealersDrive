# Requested mobile fixes and authorized sequential merges

Both requested fixes are on main, and both product PRs are merged. This report supersedes the original pre-merge Git-state checkpoint in [READINESS.md](READINESS.md).

## Mobile fixes

- The bottom enquiry button previously scrolled the collapsed panel before React committed the form. It now centers the mounted message field after the form stage renders. Login return and cancel/reopen follow the same behavior, without forcing keyboard focus.
- The dealer portfolio address now spans the mobile identity grid below the logo and dealer name. Tagline follows. Desktop layout remains unchanged.

Mobile fix commit: `6ccf12a0699b86e49149cbeb68a940159b8eecd7`. [Before/after screenshots, browser checks and provenance](follow-up-enquiry-address/README.md) include Capital Region Motors from the supplied screenshot.

## Sequential merge audit

| Item                              | Verified value                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------ |
| Mobile PR                         | [#285](https://github.com/shashikiran6sk/DealersDrive/pull/285), merged first  |
| Mobile merge                      | `25796c07b42b91fa586c63cb9cb28e9ecec75498`                                     |
| Console main update               | `14ae77630586c7cb5ab5e4442d69800d3681876d`                                     |
| Console PR                        | [#286](https://github.com/shashikiran6sk/DealersDrive/pull/286), merged second |
| Console merge / final main        | `5ce6df503a33df0c199ac90e7a2941ead8c70bcb`                                     |
| Shared workspace                  | `main`, clean and fast-forwarded to remote main                                |
| Verified local combined reference | `ed5d43398ce863e36ae8a7904375dadeb332ceee`                                     |

The console branch was updated from main after #285 merged. Its three known conflicts were resolved by preserving the mobile drawer/status host and console utility footer, combining four metrics with the mobile-safe dashboard grid, and combining mobile link sizing with footer/scroll behavior. The complete console tree and final main tree are byte-identical to the updated local reference. No integration branch was pushed and no third product PR was opened.

The repository allows squash merges only. Both `gh pr merge --squash --admin --match-head-commit ...` commands were attempted in this session as authorized, but the CLI API endpoint returned Forbidden. The connected GitHub merge tool completed both merges with exact expected-head guards. No branch protection, repository setting, permanent admin preference or global CLI alias was changed.

## Final verification

| Check                     | Mobile final head           | Console final combined head |
| ------------------------- | --------------------------- | --------------------------- |
| Formatting / lint / docs  | Pass                        | Pass                        |
| Production build          | Pass                        | Pass                        |
| Type checks               | Pass                        | Pass                        |
| Full local suite          | **4,920 passed**            | **4,929 passed**            |
| Web / contracts / API     | 1,479 / 427 / 3,014         | 1,488 / 427 / 3,014         |
| Exact-head PR CI/Security | **6/6 passed before merge** | **6/6 passed before merge** |

Post-merge main release build and both security checks also pass.

Follow-up browser evidence adds **55 passing assertions**: 40 enquiry/address/desktop/reopen checks and 15 final authenticated console checks. All **eight** matched desktop portfolio pairs are pixel-identical. Two unit regression assertions and 21 complete before-fix browser assertions intentionally reproduce the defects; their after-fix runs pass. The original component/page matrices remain archived with their actual commit provenance and are not represented as wholly rerun on these follow-up heads.

Final console browser checks include real local OTP/public workspace entry, actual drawer status/logout at six phone widths, desktop avatar removal/sidebar logout, cookie clearing and protected-route redirection. Native helper files, JSON results, screenshots, full suite/build/type/lint logs and [passing exact-head CI links](follow-up-enquiry-address/ci-before-merges.json) are in the follow-up folder.

Final source audit from original main shows no API endpoint, contract, migration, backend business logic, auth-action, dependency or infra changes. Actual source matches the verified combined implementation. Hardware keyboards/safe areas, production SMS and real Google OAuth were not run; local OTP fixtures and jobs-disabled services were used. No enquiry was submitted during this follow-up and no external message was sent.
