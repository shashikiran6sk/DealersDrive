# Pre-production fix-stack evidence archive

This branch (`testing_evidence`) is an **archive**. It is never merged, never
deployed and never used as a base for product changes. Its draft PR exists so
the evidence stays reviewable next to the PRs it proves.

During the stack review, every certification-only artifact (screenshots,
sanitized command logs, JSON probe output, reproduction diagnostics, manifests,
per-fix READMEs and retest reports) was copied here **before** it was removed
from the bug-fix PR it arrived in. Permanent automated tests stayed in the
product PRs.

| Folder                                                                | Came from                                                                                    | Product PR |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------- |
| `404/`                                                                | `claude/serene-thompson-yuft81` @ `107a46259f1e8ee13765e3a3559fe5b5bbc88c99`                 | #209       |
| `BUG-001/`                                                            | `fix/pre-production-01-invitation-race` @ `1f38a1333fb2fa6f933c3a1972a3a4298a2d071e`         | #231       |
| `BUG-002/`                                                            | `fix/pre-production-02-approval-gate` @ `3570dcf5dcffb85235315eaed8e69c54bab1f87a`           | #232       |
| `BUG-NEW-005/`                                                        | `fix/pre-production-new-005-rejection-race` @ `d29d9b960a1835d61a89e80b03de63430adc1bdc`     | #233       |
| `BUG-003/`                                                            | `fix/pre-production-03-stable-pagination` @ `62b14915dec43118994b11f88f8a00191d2e55d8`       | #234       |
| `BUG-004/` (and #235's updates to `BUG-003/`)                         | `fix/pre-production-04-suspended-media` @ `adeb847c19a0740270929a014594d1ce6c73a567`         | #235       |
| `BUG-005/` (and #236's updates to `BUG-004/`)                         | `fix/pre-production-05-membership-commit-guard` @ `e80d124ff0d7cfdb7bc39a97757484eb7d6b931a` | #236       |
| `../pre-production/` (Agent 2's original 556-case dossier, 162 files) | `fix/pre-production-01-invitation-race` @ `1f38a13`, updated by later layers                 | #231–#238  |
| `_handoff/`                                                           | Agent 2's final handoff and machine-readable checkpoint (supplied by owner)                  | —          |

Paths are preserved exactly as they were on the source branch, so a link of the
form `docs/testing/fixes/<bug>/…` in an older PR description resolves here.

Sources are recorded per layer below as they are archived.

`_handoff/` files are byte-for-byte the owner-supplied uploads except for Prettier whitespace normalisation.
