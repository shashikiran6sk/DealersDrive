# Final certification — Dealers-Drive pre-production (main `f74401a`)

**Decision: NO GO.**

Certified commit: `main` @ `f74401aef953df289acb51d53cae95284681715c` (after #209 and
#231–#238). Environment: isolated container, PostgreSQL 16, local storage, fake OTP,
console mail, Playwright Chromium 1194. No production system, credential or customer data
was touched; nothing was deployed.

## 1. Totals

| Status         | Count                                                                       |
| -------------- | --------------------------------------------------------------------------- |
| PASS           | 543                                                                         |
| FAIL           | 1 (BROWSER-009, P3)                                                         |
| BLOCKED        | 10 (4 MSG91, 4 non-Chromium browsers, 2 backup/restore)                     |
| NOT_APPLICABLE | 2 (AUTH-012 logout-all, DEALER-LIFE-017 CLOSED lifecycle — owner decisions) |
| **Total**      | **556 / 556 — completeness OK**                                             |

The canonical registry passes almost entirely. The launch blockers sit **outside** it:
they are discovered scenarios (SEC-DISC, API-DISC, BUG-NEW-*) the registry does not ask
about, all reproduced on `main`.

## 2. Remaining launch blockers

| Sev    | ID                                                                                                    | One line                                                                                                                                           | Fix direction                                                                                                                                                                                   |
| ------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0** | ORIG-BUG-001                                                                                          | Anyone can forge `/uploads` and `/private` signatures with the committed default secret, and in production those routes write to and read from R2. | Refuse the default `UPLOAD_SIGNING_SECRET` in production, and stop mounting `/uploads` and `/private` when the storage driver is r2 (use real R2 presigned URLs).                               |
| **P1** | ORIG-BUG-004                                                                                          | An ACTIVE dealer can destroy, replace or delete VERIFIED KYC documents, and merely requesting an upload URL deletes the verified file.             | Refuse document presign/delete for VERIFIED documents of an approved dealer, or route replacement through a pending re-verification that keeps the verified file until the new one is approved. |
| **P1** | BUG-NEW-010                                                                                           | A car page viewed before a dealer's suspension stays public (200) for minutes afterwards while the API returns 404.                                | On suspend, reinstate and listing state changes, revalidate every vehicle and dealer tag of that dealer, and do not keep serving cached data when the refetch returns 404.                      |
| P2     | BUG-NEW-012                                                                                           | A queued enquiry write commits after the author's membership is removed.                                                                           | Run enquiry writes through `authorizeDealerWrite` inside the transaction, as #236 does for vehicles.                                                                                            |
| P2     | ORIG-BUG-005                                                                                          | Yard photo replacement bypasses moderation.                                                                                                        | Hold yard-photo changes as a pending profile change for Admin review.                                                                                                                           |
| P2     | BUG-NEW-009                                                                                           | A suspended dealer's yard photo stays public.                                                                                                      | Gate yard-photo media on dealer ACTIVE, like #235 does for vehicle media.                                                                                                                       |
| P2     | BUG-NEW-013 (+ORIG-BUG-006 remainder)                                                                 | Production r2 accepts a missing or loopback `S3_ENDPOINT`.                                                                                         | Require an explicit https, non-loopback `S3_ENDPOINT` in production.                                                                                                                            |
| P2     | BUG-NEW-007                                                                                           | Dealer inventory loses rows that share a timestamp.                                                                                                | Apply #234's `(createdAt, id)` keyset to the inventory list.                                                                                                                                    |
| P2     | BUG-NEW-006                                                                                           | Onboarding overflows on phones with a long email.                                                                                                  | Let the account-step value wrap (`min-w-0`, `break-words`).                                                                                                                                     |
| P2     | ORIG-GAP-CLOSE                                                                                        | A DRAFT or in-review application can't be closed without destroying it.                                                                            | Product decision: add a non-destructive CLOSE for DRAFT/PENDING that keeps the audit trail.                                                                                                     |
| P3     | ADMIN-MOBILE-DETAIL-001, ORIG-DISC-PROFILE-001, BUG-NEW-001, BUG-NEW-008, BUG-NEW-011, BUG-009, OBS-* | Hygiene.                                                                                                                                           | See BUG-REPORT.md.                                                                                                                                                                              |

## 3. External gates not certified

Real R2, MSG91, Resend and Google OAuth; deployment (ECS/Vercel, `deploy-dev` commented
out); TLS and domains; production migrations; backup/restore; observability and alerts;
real Safari/Firefox/Edge/iOS/Android; load testing; Human UAT (PENDING — see
HUMAN-UAT.md). None of these is inferred from mocked tests.

## 4. Recommended fix order (no branches created)

1. ORIG-BUG-001 (P0 storage signing)
2. ORIG-BUG-004 (P1 KYC document lifecycle)
3. BUG-NEW-010 (P1 stale suspended pages)
4. BUG-NEW-012 (enquiry commit guard)
5. BUG-NEW-009 + ORIG-BUG-005 (yard-photo lifecycle and moderation, one layer)
6. BUG-NEW-013 (production endpoint validation)
7. BUG-NEW-007 (inventory keyset)
8. BUG-NEW-006 + ADMIN-MOBILE-DETAIL-001 (mobile wrapping)
9. ORIG-GAP-CLOSE (needs a product decision first)
10. P3 batch
