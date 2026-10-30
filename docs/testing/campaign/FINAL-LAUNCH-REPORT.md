# Final launch report — production-readiness fix campaign

| Field | Value |
| --- | --- |
| Final main | `8436820` (#251) |
| Final main CI | PR exact-head CI (lint · typecheck · test · build, dependency audit, terraform) green on #251 `92d3904` (identical tree); push to main: **Security PASS**, **Release PASS** (image build only — AWS deploy disabled; nothing deployed) |
| Local gates on final main | format, lint, docs:check, typecheck, test (API 139 / web 101 / contracts 14 files), build — **all green** |
| Canonical scenarios | **556 / 556 accounted — 545 PASS · 0 FAIL · 10 BLOCKED · 1 NOT_APPLICABLE** (all re-run on final main; `registry.mjs completeness` OK) |
| Deployment | **None performed** |

## PRs merged in this campaign

| # | PR | Finding | Merge SHA |
| -- | -- | -- | -- |
| 1 | #241 | ORIG-BUG-001 (P0) forged storage upload/private-read links — stand-ins mounted only for the local driver | `b571525` |
| 2 | #242 | ORIG-BUG-004 (P1) verified KYC replace/delete while ACTIVE — locked outside DRAFT | `370f9d3` |
| 3 | #243 | BUG-NEW-010 (P1) car pages public after console suspension — Admin decisions revalidate `vehicles` | `cdf297b` |
| 4 | #244 | BUG-NEW-012 enquiry write authorised at commit time | `c80d1b2` |
| 5 | #245 | ORIG-BUG-005 + BUG-NEW-009 yard photo locked outside DRAFT; cover public only for ACTIVE | `7743f9a` |
| 6 | #246 | BUG-NEW-013 production r2 requires a public HTTPS `S3_ENDPOINT` | `b533586` |
| 7 | #247 | BUG-NEW-007 dealer inventory keyset paging | `8c64330` |
| 8 | #248 | BUG-NEW-006 + ADMIN-MOBILE-DETAIL-001 mobile overflow | `0cd9a70` |
| 9 | #249 | ORIG-GAP-CLOSE admin Close application (DRAFT/PENDING → CLOSED, reason, nothing deleted, dedicated email) | `f5e35b1` |
| 10 | #250 | P3 batch: BUG-NEW-008 local PDF MIME, BUG-NEW-011 width docs | `bab6796` |
| — | #240 | User request: R97 DD monogram branding (evidence moved to `docs/testing/branding/`) | `a8bef12` |
| 11 | #251 | BUG-NEW-010 residual found in the final pass: out-of-band suspension left warmed pages 200 indefinitely | `8436820` |

## Bugs

**Fixed and verified on final main:** ORIG-BUG-001 (P0), ORIG-BUG-004 (P1), BUG-NEW-010 (P1, both the console path and the out-of-band residual), BUG-NEW-012, ORIG-BUG-005, BUG-NEW-009, BUG-NEW-013, BUG-NEW-007, BUG-NEW-006, ADMIN-MOBILE-DETAIL-001, ORIG-GAP-CLOSE, BUG-NEW-008, BUG-NEW-011, OBS-SUBMIT-NOLOCK (via #249). Canonical transitions: BROWSER-009 FAIL → PASS (#248); DEALER-LIFE-017 NOT_APPLICABLE → PASS (#249).

**Reclassified:** ORIG-DISC-PROFILE-001 — not a bug (the 409 is documented and deliberate).

**Open, none launch-blocking (all P3 / owner decisions):** OBS-COVER-LOOKUP (perf), BUG-NEW-001 (web logs upstream detail), OBS-OUTBOX-RETRY, OBS-MEDIA-NOSTORE, OBS-AUTH-BUSY, OBS-DOC-SOLD (CLAUDE.md rule decision), BUG-009 dependency hygiene (no production-reachable high). Product follow-ups by design: a moderated yard-photo replacement for approved dealers; a re-application path for a closed applicant (support-only in V1).

## New findings from the final pass

- **BUG-NEW-010 residual (P1)** — fixed by #251 (car page 404 after 70 s, dealer page after 612 s on an out-of-band suspension; previously 200 indefinitely).
- **OBS-COVER-LOOKUP (P3)** — noted above.
- Harness-only: SEC-DISC-001 now judged on an S3-driver API (the local driver keeps its stand-ins by design and production refuses it); fixtures updated for the new KYC/yard locks, the `S3_ENDPOINT` rule and Close; SEO-010 uses a cold page (local web instances share one `.next` cache). No product bug behind any of these.

## External gates — not verifiable in this container

| Gate | Status |
| --- | --- |
| Real Cloudflare R2 (presign, upload, read, CORS, lifecycle) | BLOCKED — fake S3 / local only |
| MSG91 OTP (expiry, attempt/resend caps, outage UX — AUTH-004/006/007/008) | BLOCKED |
| Resend deliverability (verified domain, SPF/DKIM/DMARC) | BLOCKED — console mailer only |
| Real Google sign-in (OAuth client, consent screen, redirect URIs) | BLOCKED — fake Google |
| Deployment pipeline (AWS deploy disabled; images build) | BLOCKED |
| Production migrations against the managed DB | BLOCKED |
| TLS / domain / DNS | BLOCKED |
| Backup / restore (DEPLOY-009/010) | BLOCKED |
| Monitoring / alerting (Grafana, metrics token) | BLOCKED — configuration validated only |
| Browser/device coverage: Safari, Firefox, Edge, iOS (BROWSER-002/003/004/006) | BLOCKED — Chromium only |
| Human UAT | Pending (`certification/HUMAN-UAT.md`) |

## Decision

**GO for the release candidate `8436820` on engineering grounds:** no launch-blocking P0, P1, security or data-integrity issue remains open, all 556 canonical scenarios are accounted (0 FAIL), and CI/Security are green on final main.

**Launch itself is conditional** on the external gates above being completed by people with access to the real providers and infrastructure — none of them could be exercised here, and none has been marked PASS. Nothing has been deployed.
