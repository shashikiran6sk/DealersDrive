# Production-readiness fix campaign (after the stack review)

One folder per fix PR. Each holds the red run on `main` before the fix, the green run
on the fix branch, and any probe output. Product PRs carry only code, permanent tests
and a concise summary; the detail lives here.

## Checklist

| #   | Folder              | Finding                                                     | PR   | Status | Merge SHA |
| --- | ------------------- | ----------------------------------------------------------- | ---- | ------ | --------- |
| 1   | `01-p0-storage/`    | ORIG-BUG-001 (P0) forged storage upload/private-read links  | #241 | MERGED | `b571525` |
| 2   | `02-p1-kyc-lock/`   | ORIG-BUG-004 (P1) verified KYC replace/delete while ACTIVE  |      | OPEN   |           |
| 3   | `03-p1-cache/`      | BUG-NEW-010 (P1) cached car page public after suspension    |      | OPEN   |           |
| 4   | `04-enquiry-auth/`  | BUG-NEW-012 (P2) enquiry commit-time authorization race     |      | OPEN   |           |
| 5   | `05-yard-photo/`    | ORIG-BUG-005 + BUG-NEW-009 yard-photo moderation/visibility |      | OPEN   |           |
| 6   | `06-r2-endpoint/`   | BUG-NEW-013 production R2 endpoint validation               |      | OPEN   |           |
| 7   | `07-pagination/`    | BUG-NEW-007 dealer inventory stable pagination              |      | OPEN   |           |
| 8   | `08-mobile/`        | BUG-NEW-006 + ADMIN-MOBILE-DETAIL-001 mobile overflow       |      | OPEN   |           |
| 9   | `09-dealer-close/`  | ORIG-GAP-CLOSE admin Close application flow                 |      | OPEN   |           |
| 10  | `10-p3-cleanup/`    | remaining P3 batch (where grouping is safe)                 |      | OPEN   |           |
