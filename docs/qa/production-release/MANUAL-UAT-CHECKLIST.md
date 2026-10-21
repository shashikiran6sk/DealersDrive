# Manual UAT checklist (product owner)

Release candidate `6e39a9a6af7a6aaa2806e9eaab9481634fb496d2`. This is the independent human
verification, to be done on a **staging/pre-production deployment of exactly this commit**
with real providers (MSG91, Resend, Google, R2) and test accounts you control — never with real
dealers or customers. Each item lists the automated result so you know what has already been
proven and what only a human with real devices and accounts can confirm.

Priority: **P0** security/identity · **P1** core business journey · **P2** quality.
Record every result; a FAIL stops launch only if it is P0/P1 (log P2/P3 in the defect register).

## Accounts to prepare

| Account         | What it is                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| Customer C1, C2 | two phones you own (real SIMs), each signs up as a customer                                                 |
| Dealer A        | your test dealership: OWNER = a phone + Google account you own; MANAGER = C2's phone; STAFF = a third phone |
| Dealer B        | a second test dealership (another phone + Google account)                                                   |
| Admin           | an Admin Member (Google) with SUPER_ADMIN; a second with MODERATOR; a phone enrolled for admin OTP          |
| Documents       | a sample PAN-like PDF and a GST-certificate-like PDF with fake numbers, a few car photos                    |

---

### HUMAN-UAT-001 · Real OTP sign-up and sign-in · P0

Mapped: AUTH-001, AUTH-002, AUTH-003, AUTH-005, AUTH-015 · Agent: PASS (fake OTP; msg91 adapter with injected verdicts)

1. On a phone, open the site, tap Login, enter C1's number, tap Send OTP.
2. Enter a wrong 6-digit code. 3. Enter the real code from the SMS/WhatsApp. 4. Enter a name, create the account.
3. Log out. Log in again with the same number.
4. In the browser's developer tools (desktop), inspect the `dd_session` cookie.
   Expected: OTP arrives within ~30 s on the configured channel; the wrong code is refused with a clear message and no sign-in; the right code signs in; the second login reaches the same account (same name, no "create account"); the cookie is `HttpOnly`, `Secure`, `SameSite=Lax`.
   Evidence: screen recording of steps 1–5; screenshot of the cookie flags. Fail severity: P0.
   ☐ PASS ☐ FAIL — Notes: ______

### HUMAN-UAT-002 · OTP expiry, attempt and resend limits (MSG91) · P1

Mapped: AUTH-004, AUTH-006, AUTH-007 (BLOCKED in automation — MSG91 enforces these) · Agent: server refuses MSG91 refusals, no session (AUTH-DISC-003)

1. Request an OTP and wait longer than MSG91's expiry (check the widget configuration; typically 5–10 min), then enter it.
2. Request an OTP and enter wrong codes until refused. 3. Tap Resend repeatedly until refused.
   Expected: the expired code is refused; after the configured attempts the widget refuses further codes; after the configured resends it stops sending. No session in any refused case.
   Fail severity: P1. ☐ PASS ☐ FAIL — Notes: ______

### HUMAN-UAT-003 · OTP provider outage message · P2

Mapped: AUTH-008 (BLOCKED), RECOVERY-006 · Agent: API answers 503 PHONE_OTP_UNAVAILABLE on provider 500/429/timeout/network (AUTH-DISC-003)

1. On staging only, set an invalid `MSG91_AUTH_KEY` (or block `control.msg91.com` egress). 2. Try to log in.
   Expected: a clear "try again" message, no crash, no half-created account; restoring the key makes login work.
   ☐ PASS ☐ FAIL — Notes: ______

### HUMAN-UAT-004 · Dealer onboarding with real Google and documents · P1

Mapped: GOLDEN-003, ONBOARD-001…018, PROD-010, STORAGE-001/006 · Agent: PASS (Google simulated)

1. On a desktop, go to Dealer login, sign in with Dealer A's owner phone (OTP), then Continue with Google using the owner's Google account.
2. Fill business details; upload the PAN-like PDF as personal identity and the GST-like PDF as business identity; submit.
3. Log out and back in mid-way once (before submit) — the step you were on is kept.
4. As Admin (MODERATOR), open Dealers → the application; open each document; Verify both; Approve with the typed confirmation.
5. As the owner, refresh the console.
   Expected: Google returns to onboarding (no error page, correct callback domain); documents upload and open for the admin only; the application waits in review; after approval the console is active and "Add vehicle" works. Try opening a document URL in a private window — it must not load.
   Fail severity: P1 (P0 if a document opens without signing in). ☐ PASS ☐ FAIL — Notes: ______

### HUMAN-UAT-005 · Real e-mail delivery · P1

Mapped: NOTIFY-001, PROD-009, NOTIFY-DISC-001 · Agent: templates and recipients verified with the console mailer; queue throughput 30/min (BUG-104)
During HUMAN-UAT-004/006/011, watch the owner's and admin's inboxes (Gmail and one other provider).
Expected: "application received", "application approved", "new enquiry" (no buyer phone in it), "listing approved", "account suspended/reinstated" arrive in the inbox (not spam) within a few minutes, from the configured sender on your domain; the message headers show SPF, DKIM and DMARC pass.
Fail severity: P1 (spam folder/DMARC fail), P2 (delay > 10 min). ☐ PASS ☐ FAIL — Notes: ______

### HUMAN-UAT-006 · Customer golden path on a real phone · P1

Mapped: GOLDEN-001, GOLDEN-002, ENQ-CREATE-_, SAVED-_ · Agent: PASS

1. As C1 (signed out) on an iPhone: search "Creta" from the home page, open a car, swipe the gallery, open "view all", close it.
2. Tap the heart → you are asked to log in → log in → the car is saved.
3. Tap Enquire now, write a message, send. Tap Send twice quickly on a second car.
4. Open My enquiries and Saved cars. Log out, log in, open them again.
   Expected: one enquiry per car (no duplicates); the save survives logout/login; My enquiries shows "Sent". Fail severity: P1.
   ☐ PASS ☐ FAIL — Notes: ______

### HUMAN-UAT-007 · Dealer works the enquiry; admin sees the history · P1

Mapped: GOLDEN-001, ENQ-LIFE-002…009, ADMIN-ENQ-* · Agent: PASS

1. As Dealer A STAFF: open Enquiries, find C1's enquiry, see the buyer's number, Mark contacted. Confirm there is no Close button.
2. As MANAGER: Close it. 3. As Admin: Enquiries → open it.
   Expected: STAFF can only mark contacted; MANAGER closes; the admin sees customer, phone, message, dealer, car, status and "Contacted by … / Closed by …" with times. C1 sees "Contacted" then "Closed". Fail severity: P1.
   ☐ PASS ☐ FAIL — Notes: ______

### HUMAN-UAT-008 · Invite a team; switch without a second login · P0

Mapped: GOLDEN-004, GOLDEN-005, MEMBER-002…013, IDENTITY-001…007 · Agent: PASS

1. As Dealer A OWNER: Team → invite C2's phone as MANAGER and the third phone as STAFF.
2. On C2's phone (already a signed-in customer): account menu → Invitations → Accept. 3. Account menu → switch to Dealer A.
3. Switch back to personal. 5. Have someone else (a different number) try to open the invitation link/screen.
   Expected: no second OTP to switch; the right role badge; a different person cannot accept. Fail severity: P0 if a wrong person joins.
   ☐ PASS ☐ FAIL — Notes: ______

### HUMAN-UAT-009 · Revoke STAFF with the dashboard open · P0

Mapped: GOLDEN-007, MEMBER-018/019/020/022/023/024, IDENTITY-010/011, CROSS-020/024/025 · Agent: PASS

1. As STAFF on a phone: open the dealer console (tab A); in tab B open Saved cars; in tab C open My enquiries.
2. As OWNER on another device: Team → remove STAFF (confirm).
3. Back on STAFF's phone, without refreshing tab A, tap Inventory or Mark contacted.
4. Open tabs B and C. 5. Log out; log in again normally; open the old dealer console bookmark.
   Expected: the dealer action is refused and the console leaves (to Login or the customer side) — no dealer data; Saved cars and My enquiries still work; login still works; the bookmark does not open the console. Fail severity: P0.
   ☐ PASS ☐ FAIL — Notes: ______

### HUMAN-UAT-010 · Demote MANAGER while signed in · P0

Mapped: MEMBER-014/016, CROSS-016/017, Part J · Agent: PASS

1. MANAGER (C2) opens the console. 2. OWNER changes C2 to STAFF. 3. Without logging out, C2 tries Submit a draft, Mark reserved, Mark sold, Withdraw, Close an enquiry, Team, Dealer profile.
2. OWNER changes C2 back to MANAGER; C2 retries Submit.
   Expected: every privileged action refused immediately after the demotion; allowed again immediately after promotion. Fail severity: P0.
   ☐ PASS ☐ FAIL — Notes: ______

### HUMAN-UAT-011 · Suspend and reinstate a dealership · P0

Mapped: GOLDEN-008, DEALER-LIFE-001…016, CROSS-001…006/021/022, SEARCH-005/006 · Agent: PASS (car page status BUG-101)
Setup: Dealer A has an ACTIVE car, a RESERVED car, a car in review; C1 has saved one car and has an enquiry.

1. Note the public car and dealer pages, Buy cars results, the dealer directory.
2. As Admin in the console: suspend Dealer A with a reason. 3. Immediately reload the public pages and search; as C1 open Saved cars and My enquiries; as OWNER/MANAGER/STAFF try the console; as Admin check the moderation queue.
3. Reinstate. Repeat step 3.
   Expected: right after suspension the dealer and its cars disappear from search, the directory and their pages ("not found"), C1's saved car shows as unavailable and the enquiry is still listed, every member is out of the console but can still browse as a customer; after reinstatement everything returns exactly as before (RESERVED still reserved, review still pending), nothing duplicated. Fail severity: P0.
   ☐ PASS ☐ FAIL — Notes: ______

### HUMAN-UAT-012 · Reserve, sell, withdraw, reactivate · P1

Mapped: GOLDEN-010, LISTING-LIFE-*, CROSS-008…014 · Agent: PASS

1. OWNER: Mark reserved → public page shows Reserved, no Enquire. 2. Mark sold (confirm) → the car leaves search and the dealer page; C1's saved car and enquiry remain. 3. Another car: Withdraw with a reason → gone publicly; Request reactivation → Admin approves → back on sale.
   Expected as stated; SOLD cannot be undone. Fail severity: P1. ☐ PASS ☐ FAIL — Notes: ______

### HUMAN-UAT-013 · STAFF cannot do privileged work · P0

Mapped: GOLDEN-006, STAFF-005…017 · Agent: PASS
As STAFF: create a draft, mark an enquiry contacted. Confirm there are no Submit, Reserve, Sold, Withdraw, Close, Spam, Team, Profile-edit, Documents controls. Fail severity: P0 if any privileged action succeeds.
☐ PASS ☐ FAIL — Notes: ______

### HUMAN-UAT-014 · Employee's personal activity stays personal · P1

Mapped: GOLDEN-009, CROSS-027…029 · Agent: PASS
As C2 (MANAGER of A) in personal context: save and enquire on Dealer B's car. Check Dealer A's inbox and Dealer B's inbox.
Expected: the enquiry is in B's inbox under C2's name only; A sees nothing. Fail severity: P1. ☐ PASS ☐ FAIL — Notes: ______

### HUMAN-UAT-015 · Support request message limit · P2

Mapped: SUPPORT-DISC-001/003/005 · Agent: PASS
As C1: Contact & support → create a request; send five follow-ups; try a sixth. As Admin: reply. As C1: send again. Admin resolves; C1 reopens; Admin closes.
Expected: the sixth is refused with the waiting message; after the admin reply C1 can write again; resolved = read-only with Reopen; closed = final. ☐ PASS ☐ FAIL — Notes: ______

### HUMAN-UAT-016 · Desktop browsers · P1

Mapped: BROWSER-002, BROWSER-003, BROWSER-004 (BLOCKED — Chromium only here) · Agent: Chromium PASS
In Safari (macOS), Firefox and Edge: repeat HUMAN-UAT-006 steps 1–3 and open the dealer console and admin console once each.
Expected: no layout breakage, gallery and dialogs work, login works. ☐ PASS ☐ FAIL — Notes: ______

### HUMAN-UAT-017 · Real phones · P1

Mapped: BROWSER-005, BROWSER-006 (BLOCKED), BROWSER-008/010 · Agent: emulated Chromium PASS
On an iPhone (Safari) and an Android phone (Chrome): HUMAN-UAT-006; the dealer console (inventory, enquiries, Team) as OWNER; open the invite dialog and type with the on-screen keyboard.
Expected: nothing hidden behind the keyboard or sticky bars, no sideways scrolling, buttons reachable, swipe works. ☐ PASS ☐ FAIL — Notes: ______

### HUMAN-UAT-018 · Admin sign-in methods and isolation · P0

Mapped: ADMIN-AUTH-001/008/009, ADMIN-SESSION-DISC-001/002, ADMIN-RBAC-DISC-002 · Agent: PASS (session simulated)

1. Sign in to /admin with Google; log out. 2. Sign in with the enrolled admin phone (OTP). 3. In the same browser, sign in as a customer in another tab — the admin console must not become a customer session or vice versa.
2. As SUPER_ADMIN disable the MODERATOR while the MODERATOR has the console open; the MODERATOR's next click is refused.
   Fail severity: P0. ☐ PASS ☐ FAIL — Notes: ______

### HUMAN-UAT-019 · Production storage (R2) · P0

Mapped: STORAGE-006/007/008, PROD-008 · Agent: PASS with local/fake S3

1. Upload documents and photos (HUMAN-UAT-004). 2. As Admin open a document; copy its URL; open it in a private window after a few minutes. 3. Open a public car photo URL directly.
   Expected: document URLs are short-lived signed links that stop working; no bucket listing; public photos load through the media route only. Fail severity: P0 if a KYC document is publicly fetchable.
   ☐ PASS ☐ FAIL — Notes: ______

### HUMAN-UAT-020 · Public production surface · P2

Mapped: SEO-001…010, PROD-012/013 · Agent: PASS except BUG-101
On the production domain: `https://<domain>/robots.txt`, `/sitemap.xml`, `/api/docs` (must be off), a car page's page source (canonical, og:image), `/car/does-not-exist` (note the status code with `curl -I` — expected 404 once BUG-101 is fixed), the TLS certificate.
☐ PASS ☐ FAIL — Notes: ______

### HUMAN-UAT-021 · Assistive technology · P2

Mapped: UX-001…012, MEDIA-011 · Agent: keyboard, names, focus PASS (no screen reader)
With VoiceOver (iPhone) or TalkBack (Android): log in, search, open a car, use the gallery, send an enquiry. Zoom a desktop browser to 200 %. ☐ PASS ☐ FAIL — Notes: ______

### HUMAN-UAT-022 · Decisions only the owner can make

| ID                   | Decision                                                                               | Choose                                |
| -------------------- | -------------------------------------------------------------------------------------- | ------------------------------------- |
| UPD-1 (AUTH-012)     | Is "log out of all devices" required for launch?                                       | ☐ Required ☐ Not for V1 (record it)   |
| UPD-2 (ENQ-LIFE-010) | May an OWNER/MANAGER move an enquiry back to NEW (e.g. CLOSED → NEW, CONTACTED → NEW)? | ☐ Yes, any move ☐ Restrict to: ______ |
| UPD-3 (BUG-105)      | Signed-out `/saved`: show a sign-in prompt instead of "No saved cars yet"?             | ☐ Yes ☐ No                            |
| UPD-4 (BUG-110)      | Hide listing credits until billing exists?                                             | ☐ Hide ☐ Keep                         |

---

## Operator checks (infrastructure — not UAT, but required before GO)

| ID     | Check                                                                                                                                                                                                                                                 | Mapped                           | Agent                                   |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------- |
| OP-001 | Restore the latest production-like RDS snapshot (or a point-in-time) into a staging instance, run `prisma migrate status`, boot the API against it, and repeat the d04 comparison (`harness/d04-backup-restore.mjs` with `CERT_DB` pointed at a copy) | DEPLOY-009 (BLOCKED), DEPLOY-010 | logical dump/restore drill PASS locally |
| OP-002 | `prisma migrate deploy` against a copy of the production database (the eight migrations reverted by #331 were never applied there — confirm `_prisma_migrations` matches this commit's 56)                                                            | DEPLOY-001, DEPLOY-005           | PASS on a fresh local database          |
| OP-003 | Confirm production env values without printing them: storage r2 with an HTTPS endpoint, msg91, resend, a non-default `SESSION_SECRET` and `UPLOAD_SIGNING_SECRET`, `DOCS_ENABLED=false`, metrics token set                                            | PROD-001…013                     | boot-time guards PASS                   |
| OP-004 | Decide `notification.email` worker concurrency for launch volume (BUG-104) and add a queue-depth alert                                                                                                                                                | PERF-DISC-001                    | measured 30/min                         |
