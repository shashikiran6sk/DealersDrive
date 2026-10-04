# Production-readiness fix campaign (after the stack review)

One folder per fix PR. Each holds the red run on `main` before the fix, the green run
on the fix branch, and any probe output. Product PRs carry only code, permanent tests
and a concise summary; the detail lives here.

| #   | Folder           | PR   | Finding                                |
| --- | ---------------- | ---- | -------------------------------------- |
| 1   | `01-p0-storage/` | #241 | ORIG-BUG-001 (P0) forged storage links |
