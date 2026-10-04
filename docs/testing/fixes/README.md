# Pre-production fix-stack evidence archive

This branch (`testing_evidence`) is an **archive**. It is never merged, never
deployed and never used as a base for product changes. Its draft PR exists so
the evidence stays reviewable next to the PRs it proves.

During the stack review, every certification-only artifact (screenshots,
sanitized command logs, JSON probe output, reproduction diagnostics, manifests,
per-fix READMEs and retest reports) was copied here **before** it was removed
from the bug-fix PR it arrived in. Permanent automated tests stayed in the
product PRs.

| Folder      | Came from                                                                    | Product PR |
| ----------- | ---------------------------------------------------------------------------- | ---------- |
| `404/`      | `claude/serene-thompson-yuft81` @ `107a46259f1e8ee13765e3a3559fe5b5bbc88c99` | #209       |
| `_handoff/` | Agent 2's final handoff and machine-readable checkpoint (supplied by owner)  | —          |

Paths are preserved exactly as they were on the source branch, so a link of the
form `docs/testing/fixes/<bug>/…` in an older PR description resolves here.

Sources are recorded per layer below as they are archived.

`_handoff/` files are byte-for-byte the owner-supplied uploads except for Prettier whitespace normalisation.
