# Human UAT — what an agent could not certify

Status: **PENDING**. Nothing here has been signed off by a person. Every item below is
either BLOCKED in the registry or was exercised only through a stand-in (fake OTP,
simulated Google identity, inserted Admin session, local storage, emulated mobile).

## A. Real providers (never exercised by the agent)

| #   | Check                                                                                                                                                                       | Why it is here                                       | Registry                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------- |
| A1  | Real MSG91 OTP: send, expiry, wrong-code attempts, resend limit, provider outage message                                                                                    | Fake OTP driver only                                 | AUTH-004, AUTH-006, AUTH-007, AUTH-008 |
| A2  | Google sign-in for dealers and Admin (consent, account linking, wrong account)                                                                                              | Google not configured; SIM-GOOGLE / SIM-SESSION used | ONBOARD-_, ADMIN-AUTH-_ (logic PASS)   |
| A3  | Resend email delivery (approval, rejection, suspension, reinstatement, invitations)                                                                                         | Console mail driver                                  | NOTIFY-* (logic PASS)                  |
| A4  | Cloudflare R2: presign/upload/read/delete, Content-Type of private PDFs (BUG-NEW-008), CDN behaviour with `no-store` media                                                  | Local storage driver                                 | STORAGE-_, MEDIA-_                     |
| A5  | **Before launch:** confirm production sets a strong `UPLOAD_SIGNING_SECRET` and that `/uploads` and `/private` are unreachable or unusable in production (ORIG-BUG-001, P0) | Code defaults to a committed secret                  | SEC-DISC-001                           |

## B. Real browsers and devices

| #   | Check                                                                                                                                 | Registry    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| B1  | Safari desktop (macOS): search, car page, sign-in, enquiry, dealer console, Admin                                                     | BROWSER-002 |
| B2  | Firefox desktop                                                                                                                       | BROWSER-003 |
| B3  | Microsoft Edge desktop                                                                                                                | BROWSER-004 |
| B4  | Safari on a real iPhone (incl. the OTP digit inputs with the iOS keyboard and SMS autofill)                                           | BROWSER-006 |
| B5  | Real Android Chrome (only emulated here)                                                                                              | BROWSER-005 |
| B6  | Admin dealer detail at 320 px (ADMIN-MOBILE-DETAIL-001) and dealer onboarding at 320/390 (BUG-NEW-006) — expected to fail until fixed | BROWSER-009 |

## C. Deployment and operations

| #   | Check                                                                                                        | Registry               |
| --- | ------------------------------------------------------------------------------------------------------------ | ---------------------- |
| C1  | Production deployment pipeline (ECS API + Vercel web); `deploy-dev` is currently commented out               | DEPLOY-*               |
| C2  | Prisma migrations against the production database (dry run on a snapshot)                                    | DEPLOY-*               |
| C3  | Backup and restore drill on the managed database; verify lifecycle/authorization relationships after restore | DEPLOY-009, DEPLOY-010 |
| C4  | TLS, domain, `WEB_BASE_URL`/`API_BASE_URL`/`MEDIA_BASE_URL`, `S3_ENDPOINT` set explicitly (BUG-NEW-013)      | PROD-*                 |
| C5  | Observability: logs reach the aggregator, alerts fire on 5xx and outbox failures (OBS-OUTBOX-RETRY)          | OBS-*                  |
| C6  | Load / performance smoke against production-sized data (image `no-store` cost, OBS-MEDIA-NOSTORE)            | —                      |

## D. Business journeys to walk through by hand (agent PASS, human sign-off needed)

1. GOLDEN-001 — visitor → search → car → OTP → enquiry → STAFF contacts → MANAGER closes → Admin history.
2. GOLDEN-002 — save → logout → login → saved and enquiry history persist.
3. GOLDEN-003 — new dealer → documents → Admin approval → listing → moderation → enquiry → SOLD.
4. GOLDEN-004/005 — invite STAFF / MANAGER → accept → switch workspace without re-login → submit → approve → SOLD.
5. GOLDEN-006/007 — STAFF limits; owner revokes STAFF and the open tab loses access.
6. GOLDEN-008 — Admin suspends a dealer with live stock; **check that already-viewed car pages disappear** (BUG-NEW-010 is expected to fail until fixed); reinstate.
7. GOLDEN-009 — a dealer employee enquiring personally with another dealer stays isolated.
8. GOLDEN-010 — ACTIVE → RESERVED → SOLD and history preservation.
9. Product decision: closing a DRAFT / in-review dealership (ORIG-GAP-CLOSE).

## E. Sign-off

| Area                 | Owner | Date | Result |
| -------------------- | ----- | ---- | ------ |
| Providers (A)        |       |      |        |
| Browsers/devices (B) |       |      |        |
| Deployment/ops (C)   |       |      |        |
| Journeys (D)         |       |      |        |
