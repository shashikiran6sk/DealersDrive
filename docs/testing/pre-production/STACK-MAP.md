# Unmerged PR stack

| Layer                                  | PR          | Branch                                  | Base                            | Current status                                                                 |
| -------------------------------------- | ----------- | --------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| Branded 404 / BUG-007                  | #209        | `claude/serene-thompson-yuft81`         | `main`                          | `107a462`; remote CI / Security PASS                                           |
| BUG-001 invitation lock order          | #231        | `fix/pre-production-01-invitation-race` | `claude/serene-thompson-yuft81` | Implementation `455938b`; Agent retest and local gates PASS; remote CI running |
| BUG-002 dealer approval gate           | Not started | Not created                             | BUG-001 branch                  | Planned next; no implementation yet                                            |
| BUG-003 tied pagination                | Not started | Not created                             | Latest preceding fix branch     | Planned                                                                        |
| BUG-004 suspended media                | Not started | Not created                             | Latest preceding fix branch     | Planned                                                                        |
| BUG-005 in-flight member authorization | Not started | Not created                             | Latest preceding fix branch     | Planned                                                                        |
| BUG-006 production storage guard       | Not started | Not created                             | Latest preceding fix branch     | Planned                                                                        |
| BUG-008 Admin mobile overflow          | Not started | Not created                             | Latest preceding fix branch     | Planned                                                                        |
| BUG-009 dependencies (provisional)     | Not started | Not created                             | Latest preceding fix branch     | Assess deployed paths and patch as needed                                      |
| BUG-NEW-001 framework log privacy      | Not started | Not created                             | Latest preceding fix branch     | P2 provisional; dedicated fix required                                         |

The user’s seven primary product bugs beyond the branded 404 are BUG-001–006 and BUG-008. BUG-009 is the additional provisional audit finding retained from baseline. BUG-NEW-002 is a directly coupled consequence of the invitation lock order; it has separate regression attribution within BUG-001’s required correction.

Every new branch must descend from the current top and its PR must target that immediately preceding branch. Verify the remote diff contains only its layer. Complete appropriate local tests and actual remote CI before advancing. Record source/tested SHAs and evidence separately from historical baseline results.

No PR has been merged, force-pushed or rebased. Human UAT: PENDING. Overall production GO: not yet established. Recommended eventual merge order follows this table, subject to the user’s explicit approval.
