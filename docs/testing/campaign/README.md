# Production-readiness fix campaign (after the stack review)

One folder per fix PR. Each holds the red run on `main` before the fix, the green run
on the fix branch, and any probe output. Product PRs carry only code, permanent tests
and a concise summary; the detail lives here.

## Checklist

| #   | Folder             | Finding                                                     | PR   | Status  | Merge SHA |
| --- | ------------------ | ----------------------------------------------------------- | ---- | ------- | --------- |
| 1   | `01-p0-storage/`   | ORIG-BUG-001 (P0) forged storage upload/private-read links  | #241 | MERGED  | `b571525` |
| 2   | `02-p1-kyc-lock/`  | ORIG-BUG-004 (P1) verified KYC replace/delete while ACTIVE  | #242 | MERGED | `370f9d3` |
| 3   | `03-p1-cache/`     | BUG-NEW-010 (P1) cached car page public after suspension    | #243 | MERGED | `cdf297b` |
| 4   | `04-enquiry-auth/` | BUG-NEW-012 (P2) enquiry commit-time authorization race     | #244 | MERGED | `c80d1b2` |
| 5   | `05-yard-photo/`   | ORIG-BUG-005 + BUG-NEW-009 yard-photo moderation/visibility | #245 | MERGED | `7743f9a` |
| 6   | `06-r2-endpoint/`  | BUG-NEW-013 production R2 endpoint validation               | #246 | MERGED | `b533586` |
| 7   | `07-pagination/`   | BUG-NEW-007 dealer inventory stable pagination              |      | OPEN    |           |
| 8   | `08-mobile/`       | BUG-NEW-006 + ADMIN-MOBILE-DETAIL-001 mobile overflow       |      | OPEN    |           |
| 9   | `09-dealer-close/` | ORIG-GAP-CLOSE admin Close application flow                 |      | OPEN    |           |
| 10  | `10-p3-cleanup/`   | remaining P3 batch (where grouping is safe)                 |      | OPEN    |           |

## New observations raised during the campaign

| ID                | Sev | Found in | Note                                                                                                                                                                                                                                                                      |
| ----------------- | --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OBS-SUBMIT-NOLOCK | P3  | fix 2    | `submitForVerification` reads completeness without the dealer row lock; a DRAFT document replace racing a submit can leave a PENDING application with an UPLOADING slot. Not approvable (verify refuses UPLOADING), so no integrity hole; the admin must request changes. |
| OBS-STALE-404 | P3 | fix 3 | Next caches only 200s, so a car removed from public view by anything other than a web action stays cached until a tag revalidation. No such path exists today (`listings.expire-sweep` is reserved, unimplemented). |
