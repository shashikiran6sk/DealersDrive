# Android stack integration — final report (2026-10)

This is the closing report for the reviewed squash integration of #279 and F099–F112 (#312–#325), plus the remediation PRs. The per-PR record, the reconciliation procedure and the dry run are in [MANIFEST.md](MANIFEST.md).

## 1. Integration summary

| PR   | Feature                        | Squash on `main` | Reviewed head |
| ---- | ------------------------------ | ---------------- | ------------- |
| #279 | Legal policies and consent     | `9861483`        | `bda0bce`     |
| #312 | F099 mobile foundation         | `d1cc78d`        | `eb4d317`     |
| #313 | F100 native auth backend       | `0e40bee`        | `bc99ccd`     |
| #314 | F101 native auth UI            | `1e2aada`        | `7add579`     |
| #315 | F102 cars, filters, gallery    | `c1a46af`        | `d2e744d`     |
| #316 | F103 Home and dealers          | `a3010d9`        | `0e52c24`     |
| #317 | F104 saved and agreements      | `d893fa8`        | `56b7187`     |
| #318 | F105 consent and enquiries     | `c99b4c0`        | `1263fb3`     |
| #319 | F106 support                   | `56ae0aa`        | `41a0c7a`     |
| #320 | F107 deactivation and deletion | `4ae9653`        | `de96739`     |
| #321 | F108 release hardening         | `d2c1100`        | `55795e7`     |
| #322 | F109 UX foundation             | `e3463c2`        | `c5d96a1`     |
| #323 | F110 discovery and search      | `c0f67f8`        | `1fbfab8`     |
| #324 | F111 customer journeys         | _pending_        | `fe4291b`     |
| #325 | F112 UX hardening              | _pending_        | _pending_     |

- Every squash tree equals the head that was reviewed and passed CI.
- Each PR was merged on its own, after `expectedHeadSha` confirmed the head.
- No branch was force-pushed or rewritten. Descendants were reconciled with merge commits: merge the final parent head, then record `main` with `-s ours`. A patch-equivalence gate showed each PR's diff against `main` equals its original diff, apart from the explained fixes.
