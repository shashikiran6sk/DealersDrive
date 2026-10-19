# Independent product-owner UAT — all results PENDING

Baseline `d6ae115359c4d0ae7ab0fd5115336291666cbb08`. **NO GO remains in force.** The agent has not signed off on your behalf. Perform these tests independently and record PASS/FAIL, actual outcome, timestamp, browser/device and screenshots. A blocked agent case does not become PASS through these instructions.

## Setup before you begin

A QA operator must provide an accessible isolated pre-production URL for this SHA, a working configured OTP channel, Google test identities, mail inbox and disposable DB/storage. The current loopback cloud runtime is not a publicly accessible owner UAT deployment. Until those prerequisites exist, affected human results remain PENDING; do not use the live production site.

Use separate browser profiles labelled Customer A, Customer B, Dealer A OWNER, Dealer A MANAGER, Dealer A STAFF, Dealer B OWNER and Admin. A person account uses the normal Login link and verified phone. Admin uses the Admin Google login. QA supplies fictional phones/credentials privately; no credential belongs in this workbook.

Prepare dealer A and B as approved ACTIVE, one incomplete DRAFT dealer with its document checklist still REQUIRED, a PENDING_APPROVAL dealer, and listings labelled ACTIVE-A, ACTIVE-B, RESERVED-A, SOLD-A, WITHDRAWN-A, DRAFT-A, REVIEW-A, REJECTED-A and CHANGES-A. Each published fixture needs six non-sensitive images. Prepare an existing customer invitation, a new-phone invitation, expired/revoked invitations, saved cars and enquiry histories. Supply resource IDs, public slugs and expected counts on a private fixture sheet. Reset disposable fixtures between destructive cases. Never include real KYC/customer documents.

For direct API checks, QA supplies an authenticated Postman collection/environment with the same identities and private variables `dealerAId`, `dealerBId`, `vehicleAId`, `vehicleBId`, `listingAId`, `enquiryAId`, `enquiryBId`, `membershipAId`, `invitationId`. In requests below replace braces with fixture-sheet IDs. Use the profile specified for each request. No source-code inspection is needed. A permission button being hidden is insufficient: also send the documented API request. Clear auth before anonymous tests.

Run the journeys below first on desktop, then repeat the customer search/save/enquiry, dealer dashboard/draft/enquiries/Team and Admin views on a real Android/iPhone/tablet as available. Test the actual keyboard, portrait/landscape, browser back and refresh. Do not substitute viewport screenshots for real-device checks.

## Priority journeys

### HUMAN-UAT-J001 — New and existing customer login

Mapped tests: AUTH-001 AUTH-002 AUTH-003 AUTH-004 AUTH-005 AUTH-006 AUTH-007 AUTH-008 AUTH-009 AUTH-010 AUTH-011 AUTH-012 AUTH-013 AUTH-015 CUSTOMER-001 CUSTOMER-004. Priority: P1. Agent results: PASS: 6, FAIL: 0, BLOCKED: 10; consult each registry row.

Setup: Customer A, a second new fictional phone, an incorrect code, an expired proof and a used proof prepared by QA; production-like HTTPS cookies.

Steps:

1. From homepage select Login, enter the new phone and select Send OTP.
2. Enter the delivered code, select Verify and sign in, enter a name if asked and select Create account. Confirm the avatar/menu identifies that human.
3. Logout, repeat login with that same phone and confirm no name/signup step or duplicate account.
4. In fresh attempts enter the incorrect and expired codes; try a previously used proof in the supplied API collection. Expect refusal and no new authenticated session.
5. Request/resend or submit repeatedly up to the documented limits; observe the limit message and recovery window. QA disables the provider for one attempt; expect recoverable error, not account creation.
6. Refresh during verification; use two tabs with different in-progress phones and prove the authenticated identity matches the successfully verified number.
7. Logout and request a private page/API with the old cookie. Ask QA to expire a session and repeat. If logout-all is supported, invoke it and test another active profile; otherwise record a blocked product-policy decision.
8. On HTTPS inspect cookie attributes in browser Application/Storage: HttpOnly, Secure and intended SameSite/path/domain; do not copy its value.

Expected: Correct identity; reusable existing account; invalid/expired/used proofs refused; limits and failure recovery work; old/expired sessions lose protected access.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / screenshot / timestamp / browser: ____________________

### HUMAN-UAT-J002 — Saved cars and customer account

Mapped tests: SAVED-001 SAVED-002 SAVED-003 SAVED-004 SAVED-005 SAVED-006 SAVED-007 SAVED-008 SAVED-009 SAVED-010 CUSTOMER-002 CUSTOMER-003 CUSTOMER-005 CUSTOMER-006 CUSTOMER-007 CUSTOMER-008 CUSTOMER-009 CUSTOMER-010. Priority: P1. Agent results: PASS: 14, FAIL: 0, BLOCKED: 4; consult each registry row.

Setup: Customer A/B; ACTIVE-B saved by A; lifecycle variants on fixture sheet.

Steps:

1. As anonymous visitor press the save heart on ACTIVE-B and confirm the intended login return path.
2. As Customer A save ACTIVE-B; open Saved cars from account menu and verify the same car. Remove it, verify removal, then save again and double-click.
3. Logout and log in again through normal OTP. Saved car and personal My enquiries remain present.
4. As Dealer B OWNER move that saved listing through RESERVED, SOLD or WITHDRAWN in separate reset runs. Refresh A’s Saved cars and My enquiries: clear unavailable/history behavior, no broken page or deleted history.
5. Make A a dealer member; later remove membership and suspend the employer in separate runs. Confirm A can still use Saved cars and My enquiries.
6. As Customer B, attempt A’s saved/enquiry identifiers in the supplied API collection; B must not read or mutate A’s data.

Expected: Human-owned saved/history records persist through lifecycle and employer changes; duplicate save is one row; customers remain isolated.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / screenshot / timestamp / browser: ____________________

### HUMAN-UAT-J003 — Complete dealer onboarding

Mapped tests: ONBOARD-001 ONBOARD-002 ONBOARD-003 ONBOARD-004 ONBOARD-005 ONBOARD-006 ONBOARD-007 ONBOARD-008 ONBOARD-009 ONBOARD-010 ONBOARD-011 ONBOARD-012 ONBOARD-013 ONBOARD-014 ONBOARD-015 ONBOARD-016 ONBOARD-017 ONBOARD-018. Priority: P1. Agent results: PASS: 4, FAIL: 0, BLOCKED: 14; consult each registry row.

Setup: A new eligible person, a partly completed dealer draft, required fixture documents and Google test identity.

Steps:

1. Use the offered dealer onboarding entry and normal required identity/phone/Google linking steps. Confirm the same human account is reused.
2. Complete required business name, address/district/map, description/services and contact fields. Leave each required field blank once and try Continue/submit; the server must refuse it.
3. Upload each required document to its named checklist slot. Try a wrong file type and an oversized file; expect refusal. Keep all uploads fictional.
4. Refresh partway, logout/login and reopen onboarding; persisted fields/documents remain associated with that draft.
5. Submit the completed application twice rapidly; one dealership/application should exist in the review state.
6. Using Dealer B identity, request A’s document/upload IDs from the collection; expect denial. Using the applicant identity, attempt Admin approval and public listing submission; expect denial.
7. As Admin inspect this submitted application, comparing owner, contact, business fields and document slots to the fixture sheet.

Expected: One correctly linked human/dealer, resumable draft, enforced required data, private correct documents, non-public unapproved dealer and correct review state.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / screenshot / timestamp / browser: ____________________

### HUMAN-UAT-J004 — Dealer review, incomplete approval, rejection and audit

Mapped tests: VERIFY-001 VERIFY-002 VERIFY-003 VERIFY-004 VERIFY-005 VERIFY-006 VERIFY-007 VERIFY-008 VERIFY-009 VERIFY-010 VERIFY-011 VERIFY-012 VERIFY-013 VERIFY-014 ADMIN-DEALER-002 ADMIN-DEALER-003 ADMIN-DEALER-004 ADMIN-DEALER-005. Priority: P1. Agent results: PASS: 0, FAIL: 1, BLOCKED: 17; consult each registry row.

Setup: Admin; one complete submitted application and one incomplete DRAFT dealer. Disposable rejection/remediation fixture.

Steps:

1. Open Admin → Dealers and inspect the submitted application and documents.
2. Approve the complete submitted application. Reopen its dealer profile/session and verify ACTIVE plus only intended permissions.
3. For the incomplete DRAFT fixture, send Admin POST /v1/admin/dealers/{dealerId}/approve with {} before documents are uploaded. Inspect status in Admin and dealer account. This is the known BUG-002 reproduction; activation is FAIL.
4. In a separate fixture, reject with a meaningful reason; verify the application’s documented purge/remediation behavior. Distinguish final rejection from Request changes.
5. For Request changes, correct the named fields/documents, resubmit and inspect the new review state. If the requested rejected resubmission policy is undefined, record the policy question instead of a pass.
6. In two Admin profiles submit conflicting review decisions together. Ask QA for the recorded DB/audit outcome; one valid final state and attributable audit trail are required.

Expected: Only complete eligible applications activate; invalid/concurrent review cannot bypass verification; supported remediation and audit remain consistent.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / screenshot / timestamp / browser: ____________________

### HUMAN-UAT-J005 — Roles, drafts and listing moderation

Mapped tests: LISTING-CREATE-001 LISTING-CREATE-002 LISTING-CREATE-003 LISTING-CREATE-004 LISTING-CREATE-005 LISTING-CREATE-006 LISTING-CREATE-007 LISTING-CREATE-008 LISTING-CREATE-009 LISTING-CREATE-010 LISTING-CREATE-011 LISTING-CREATE-012 LISTING-CREATE-013 LISTING-CREATE-014 LISTING-CREATE-015 LISTING-CREATE-016 MODERATION-001 MODERATION-002 MODERATION-003 MODERATION-004 MODERATION-005 MODERATION-006 MODERATION-007 MODERATION-008 MODERATION-009 MODERATION-010 MODERATION-011 MODERATION-012 MODERATION-013 MODERATION-014 MODERATION-015 MODERATION-016 MODERATION-017 MODERATION-018. Priority: P1. Agent results: PASS: 19, FAIL: 0, BLOCKED: 15; consult each registry row.

Setup: Dealer A OWNER/MANAGER/STAFF, Dealer B, Admin; fresh plates and valid/invalid data/media.

Steps:

1. Login as STAFF through normal customer OTP, open account menu → Dealer dashboard → Add vehicle, enter a fresh registration and Continue.
2. Enter some permitted data and Save draft. Refresh and reopen the same draft from Inventory. QA verifies dealer A ownership and STAFF creator on the fixture sheet.
3. Complete all required fields. Try negative/invalid price, year/km and blank required values; submit via the collection to ensure server validation.
4. As STAFF try Submit in UI and POST /v1/dealer/vehicles/{vehicleId}/submit. It must be unavailable/403. As MANAGER or OWNER submit the completed draft; verify PENDING_REVIEW and hidden public URL.
5. As Dealer B read/edit/delete A’s draft ID through the collection; compare with an unknown ID and confirm no changes.
6. As Admin → Listings inspect the review row, data/checklist and six images. Approve only an eligible complete listing. Open /cars and the public URL; confirm ACTIVE and correct dealer.
7. In fresh fixtures choose Request changes and resubmit after correction, then choose Reject and verify finality/non-public history. Record that rejected resubmission differs from changes-requested policy.
8. Use two profiles for duplicate Submit and concurrent approve/reject. Confirm one state/decision and audit entry through QA evidence; no duplicate listing.

Expected: All three roles prepare permitted drafts; only OWNER/MANAGER submit; server validates ownership/data; only valid Admin review publishes; rejection/change workflows and audit are consistent.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / screenshot / timestamp / browser: ____________________

### HUMAN-UAT-J006 — Enquiry creation, contact, closure and history

Mapped tests: ENQ-CREATE-001 ENQ-CREATE-002 ENQ-CREATE-003 ENQ-CREATE-004 ENQ-CREATE-005 ENQ-CREATE-006 ENQ-CREATE-007 ENQ-CREATE-008 ENQ-CREATE-009 ENQ-CREATE-010 ENQ-CREATE-011 ENQ-CREATE-012 ENQ-CREATE-013 ENQ-CREATE-014 ENQ-CREATE-015 ENQ-CREATE-016 ENQ-CREATE-017 ENQ-CREATE-018 ENQ-LIFE-001 ENQ-LIFE-002 ENQ-LIFE-003 ENQ-LIFE-004 ENQ-LIFE-005 ENQ-LIFE-006 ENQ-LIFE-007 ENQ-LIFE-008 ENQ-LIFE-009 ENQ-LIFE-010 ENQ-LIFE-011 ENQ-LIFE-012 ENQ-LIFE-013 ENQ-LIFE-014 ENQ-LIFE-015 ENQ-LIFE-016 ENQ-LIFE-017 ENQ-LIFE-018 ENQ-LIFE-019 ENQ-LIFE-020 ENQ-LIFE-021. Priority: P1. Agent results: PASS: 31, FAIL: 0, BLOCKED: 8; consult each registry row.

Setup: Customer A/B, STAFF/MANAGER/OWNER A, Admin; ACTIVE-A and terminal-state vehicles.

Steps:

1. Anonymous visitor selects ACTIVE-A → Enquire now; login returns to the intended car. Check name/verified number, cancel and reopen.
2. Send once without Message, and on another car with a Message. Rapidly click/send a duplicate; only the allowed open enquiry should exist.
3. Open customer My enquiries, dealer Enquiries and Admin Enquiries; compare human, phone, message, car, dealer and status.
4. As STAFF open New tab, check the verified contact and choose Mark contacted. Confirm Contacted by that STAFF and time. Try Close in UI and PATCH /v1/dealer/enquiries/{enquiryId} with {"status":"CLOSED"}; expect 403.
5. As MANAGER choose Contacted tab → Close. Verify closed actor/time and customer CLOSED. Repeat permitted actions as OWNER in a new fixture.
6. As Customer B/Dealer B attempt A’s enquiry ID in the collection. Submit unexpected customer/dealer/status fields and an overlong message; expect controlled refusal and unchanged record.
7. Try enquiries on RESERVED, SOLD, WITHDRAWN, DRAFT and REVIEW listings. RESERVED is visible but unavailable for new enquiries; terminal/private listings refuse.
8. QA coordinates sale/suspension between opening the form and Send, concurrent status changes, and member removal after contact. Refresh all three histories; no impossible state, lost records or lost individual actor attribution.

Expected: One human-owned lead reaches the correct dealer/Admin, permissions and lifecycle enforced, contact/close actor/time and history persist through related state changes.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / screenshot / timestamp / browser: ____________________

### HUMAN-UAT-J007 — Team invitation and permission changes

Mapped tests: MEMBER-001 MEMBER-002 MEMBER-003 MEMBER-004 MEMBER-005 MEMBER-006 MEMBER-007 MEMBER-008 MEMBER-009 MEMBER-010 MEMBER-011 MEMBER-012 MEMBER-013 MEMBER-014 MEMBER-015 MEMBER-016 MEMBER-029 MEMBER-030 MEMBER-031 MEMBER-032 MEMBER-033 MEMBER-034 MEMBER-035. Priority: P1. Agent results: PASS: 19, FAIL: 0, BLOCKED: 4; consult each registry row.

Setup: Owner A; existing Customer A; new fictional phone; expired and withdrawn invitation fixtures.

Steps:

1. Owner → Dealer dashboard → Team → Invite member; enter Customer A phone, choose STAFF, Invite. Cancel/reopen first to verify no unintended invite.
2. Customer A logs in normally and accepts the offered invitation. Select Dealer dashboard in the same account menu; no extra dealer OTP/onboarding or duplicate user.
3. Repeat with MANAGER and a previously unregistered phone. Owner must never be able to invite OWNER through altered role JSON.
4. Invite the same phone twice, accept twice/together in two profiles, try a different person, expired invitation and withdrawn invitation. Expect one membership and controlled refusals.
5. Owner changes MANAGER to STAFF while the member profile stays open; member tries Submit and must be denied. Promote STAFF to MANAGER and retry eligible Submit without logout.
6. As MANAGER/STAFF try Team, invitation, role-change and removal APIs through the collection; expect denial.
7. As the last OWNER attempt self-removal and self-demotion via the collection; expect denial and retained OWNER.

Expected: Invitations bind the verified human to the correct dealer once; permissions update immediately; only OWNER manages Team and final OWNER is protected.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / screenshot / timestamp / browser: ____________________

### HUMAN-UAT-J008 — Revocation while dealer context is open

Mapped tests: MEMBER-017 MEMBER-018 MEMBER-019 MEMBER-020 MEMBER-021 MEMBER-022 MEMBER-023 MEMBER-024 MEMBER-025 MEMBER-026 MEMBER-027 MEMBER-028 IDENTITY-010 IDENTITY-011 CROSS-015 CROSS-018 CROSS-020 CROSS-024 CROSS-025 DATA-001 DATA-002 DATA-010. Priority: P1. Agent results: PASS: 13, FAIL: 0, BLOCKED: 9; consult each registry row.

Setup: STAFF A has a saved competitor car, personal enquiry, created draft and handled dealer enquiry. Owner profile open separately.

Steps:

1. STAFF logs in through normal customer login and opens Dealer dashboard; keep it open.
2. Owner opens Team → STAFF → Remove and confirms Remove from team.
3. Without logging STAFF out, refresh dashboard, try opening/editing the old draft and mark/contact a lead; protected requests must be denied.
4. STAFF opens account menu → Saved cars and My enquiries, browses /cars and a competitor car; personal account still works.
5. Logout STAFF and login again through normal customer OTP. Personal data remains; former Dealer dashboard remains denied.
6. Owner/MANAGER/Admin reopen STAFF’s created draft and handled enquiry; verify the dealership still owns records and original actor/time/history remains. QA compares pre/post record IDs/counts.

Expected: Dealer authorization revoked immediately, personal authentication/data preserved, no cascading dealer deletion or lost historical actor.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / screenshot / timestamp / browser: ____________________

### HUMAN-UAT-J009 — Suspension, reinstatement and member separation

Mapped tests: DEALER-LIFE-001 DEALER-LIFE-002 DEALER-LIFE-003 DEALER-LIFE-004 DEALER-LIFE-005 DEALER-LIFE-006 DEALER-LIFE-007 DEALER-LIFE-008 DEALER-LIFE-009 DEALER-LIFE-010 DEALER-LIFE-011 DEALER-LIFE-012 DEALER-LIFE-013 DEALER-LIFE-014 DEALER-LIFE-015 DEALER-LIFE-016 DEALER-LIFE-017 DEALER-LIFE-018 CROSS-001 CROSS-002 CROSS-003 CROSS-004 CROSS-005 CROSS-006 CROSS-021 CROSS-022 CROSS-023 CROSS-029 ADMIN-DEALER-006 ADMIN-DEALER-007 ADMIN-DEALER-008. Priority: P1. Agent results: PASS: 11, FAIL: 0, BLOCKED: 20; consult each registry row.

Setup: Dealer A ACTIVE/RESERVED/REVIEW fixtures, enquiries/saved history; one removed member; all profiles kept open.

Steps:

1. Admin → Dealers → A → Suspend with a reason.
2. In existing OWNER/MANAGER/STAFF sessions attempt inventory mutation and enquiry transition; prohibited operations must be denied immediately.
3. Anonymous visitor checks /cars, dealer portfolio, known car URL and known image URL. Compare suspension visibility policy. Known-image 200 while listing is hidden reproduces BUG-004.
4. Customers and suspended dealer members check personal Saved cars/My enquiries; history must remain non-broken.
5. During suspension remove a member, then Admin Reinstate A. Valid members regain intended operations; the removed member stays denied. Compare listing states, row counts and historical audit records.
6. For permanent deactivation use a fresh disposable fixture only and confirm historical-data policy with QA; do not permanently close a real dealer.

Expected: Suspension enforces dealer/public policy without deleting personal/historical data; reinstatement restores only valid states/members and no duplicates.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / screenshot / timestamp / browser: ____________________

### HUMAN-UAT-J010 — Listing ACTIVE/RESERVED/SOLD/WITHDRAWN

Mapped tests: LISTING-LIFE-001 LISTING-LIFE-002 LISTING-LIFE-003 LISTING-LIFE-004 LISTING-LIFE-005 LISTING-LIFE-006 LISTING-LIFE-007 LISTING-LIFE-008 LISTING-LIFE-009 LISTING-LIFE-010 LISTING-LIFE-011 LISTING-LIFE-012 LISTING-LIFE-013 LISTING-LIFE-014 LISTING-LIFE-015 LISTING-LIFE-016 LISTING-LIFE-017 LISTING-LIFE-018 LISTING-LIFE-019 LISTING-LIFE-020 LISTING-LIFE-021 LISTING-LIFE-022 LISTING-LIFE-023 LISTING-LIFE-024 LISTING-LIFE-025 LISTING-LIFE-026 LISTING-LIFE-027 LISTING-LIFE-028 LISTING-LIFE-029 LISTING-LIFE-030 LISTING-LIFE-031 CROSS-008 CROSS-009 CROSS-010 CROSS-011 CROSS-012 CROSS-013 CROSS-014 SEARCH-001 SEARCH-002 SEARCH-003 SEARCH-004 SEARCH-005 SEARCH-006 SEARCH-007 SEARCH-008 SEARCH-009 SEARCH-010 SEARCH-011 SEARCH-012. Priority: P1. Agent results: PASS: 28, FAIL: 0, BLOCKED: 22; consult each registry row.

Setup: Fresh ACTIVE-A with saved/enquiry history and recorded dealer available count; reset each role/state run.

Steps:

1. Open /cars, dealer portfolio and public car; compare ACTIVE availability and count.
2. As OWNER/MANAGER reserve through Inventory; compare RESERVED label, public navigation, enquiry refusal and available count. STAFF UI/API must refuse reserve.
3. Request return to ACTIVE through the supported reactivation review, then have Admin approve; no direct relist bypass.
4. On fresh fixtures as OWNER and MANAGER mark SOLD. Confirm public search/portfolio/direct URL and available count exclude it; internal/customer enquiry history persists. STAFF mark-sold API must fail.
5. On fresh ACTIVE fixtures as OWNER and MANAGER Withdraw with reason/note. Verify public disappearance, retained internal/history data and protected reactivation review; STAFF withdraw API must fail.
6. Send forbidden transitions and changed dealer/status fields in the collection; test simultaneous lifecycle moves with QA. Confirm one valid state, audit trail and public/read-model synchronization.

Expected: Exact lifecycle, permissions, counts, public visibility and history are consistent; terminal transitions cannot be bypassed.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / screenshot / timestamp / browser: ____________________

### HUMAN-UAT-J011 — Unified personal/dealer context and competitor isolation

Mapped tests: IDENTITY-001 IDENTITY-002 IDENTITY-003 IDENTITY-004 IDENTITY-005 IDENTITY-006 IDENTITY-007 IDENTITY-008 IDENTITY-009 IDENTITY-012 IDENTITY-013 IDENTITY-014 CROSS-026 CROSS-027 CROSS-028 GOLDEN-009. Priority: P1. Agent results: PASS: 10, FAIL: 0, BLOCKED: 6; consult each registry row.

Setup: OWNER/MANAGER/STAFF A each with ordinary customer OTP login; one nonmember, one dual-dealer member.

Steps:

1. For each role log in through the public Login/phone path; enter no dealer credentials.
2. Account menu → Dealer dashboard, then personal Saved cars/My enquiries. Switch both ways without another OTP or new identity.
3. From personal context save and enquire about ACTIVE-B. Compare the personal record in Customer/Admin and B’s inbox; employer A must not see that competitor interaction.
4. As an ordinary nonmember open the dealer bookmark/API; denial must not destroy the customer session.
5. For a dual member switch through the offered workspace choices; inventory follows the chosen membership. Alter membership/dealer IDs to another user’s values in the collection; expect denial.
6. QA records session/user counts before/after switching and confirms dealer writes retain dealer plus individual actor.

Expected: One verified human can switch authorized workspaces; personal ownership and employer data remain independent; no manipulated tenant choice.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / screenshot / timestamp / browser: ____________________

### HUMAN-UAT-J012 — Admin access and enquiry oversight

Mapped tests: ADMIN-AUTH-001 ADMIN-AUTH-002 ADMIN-AUTH-003 ADMIN-AUTH-004 ADMIN-AUTH-005 ADMIN-AUTH-006 ADMIN-AUTH-007 ADMIN-AUTH-008 ADMIN-AUTH-009 ADMIN-AUTH-010 ADMIN-DEALER-001 ADMIN-DEALER-009 ADMIN-DEALER-010 ADMIN-LISTING-001 ADMIN-LISTING-002 ADMIN-LISTING-003 ADMIN-LISTING-004 ADMIN-LISTING-005 ADMIN-LISTING-006 ADMIN-LISTING-007 ADMIN-LISTING-008 ADMIN-LISTING-009 ADMIN-LISTING-010 ADMIN-ENQ-001 ADMIN-ENQ-002 ADMIN-ENQ-003 ADMIN-ENQ-004 ADMIN-ENQ-005 ADMIN-ENQ-006 ADMIN-ENQ-007 ADMIN-ENQ-008 ADMIN-ENQ-009 ADMIN-ENQ-010 ADMIN-ENQ-011 ADMIN-ENQ-012. Priority: P1. Agent results: PASS: 18, FAIL: 0, BLOCKED: 17; consult each registry row.

Setup: Admin Google test identity plus non-admin/customer/owner/manager/staff profiles; cross-dealer enquiries.

Steps:

1. Login to Admin using the supplied authorized Google account. Attempt same entry as non-admin Google and each dealer/customer identity; verify server denial.
2. Admin → Enquiries; search by fictional customer, phone, plate and dealer; filter status/date/dealer and page through all records.
3. Open View for an enquiry. Compare customer name/phone, description, dealer, car, status and history to the fixture sheet and dealer/customer views.
4. Change dealer/listing/member state in separate profiles, then refresh Admin history. Records/actor references must persist.
5. Admin → Dealers/Listings performs permitted review/actions only. Try approving a listing whose dealer becomes suspended during review with QA coordination.
6. Expire/log out Admin and retry its old cookie/API. Confirm bootstrap access cannot create an Admin using a non-allowlisted Google identity.
7. Repeat supported views at mobile/tablet sizes; scroll tables and verify all actions remain usable. BUG-008 is currently reproducible at 390 pixels.

Expected: Only authorized Admin identities/scopes operate; aggregation/search/detail/history and responsive actions work without leaking to dealer/customer identities.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / screenshot / timestamp / browser: ____________________

### HUMAN-UAT-J013 — Direct API tenant/permission and abuse checks

Mapped tests: API-SEC-001 API-SEC-002 API-SEC-003 API-SEC-004 API-SEC-005 API-SEC-006 API-SEC-007 API-SEC-008 API-SEC-009 API-SEC-010 API-SEC-011 API-SEC-012 API-SEC-013 API-SEC-014 ABUSE-001 ABUSE-002 ABUSE-003 ABUSE-004 ABUSE-005 ABUSE-006 ABUSE-007 ABUSE-008 ABUSE-009 ABUSE-010 ABUSE-011 ABUSE-012. Priority: P1. Agent results: PASS: 19, FAIL: 0, BLOCKED: 7; consult each registry row.

Setup: QA-supplied authenticated collection with all role profiles and foreign fixture IDs; rate-limit policy documented.

Steps:

1. With auth cleared GET dealer vehicles/team/enquiries, customer saved/enquiries and Admin aggregation; each protected collection refuses access.
2. Repeat dealer calls as a nonmember customer; privileged listing transitions as STAFF; Team/profile/KYC writes as MANAGER; Admin calls as OWNER. Verify expected 401/403 and no mutation.
3. As A substitute B vehicle/enquiry/team IDs in GET/PATCH/DELETE requests; compare unknown UUID responses and ask QA to confirm B’s rows unchanged.
4. Send malformed IDs and unexpected dealerId/customerId/role/status/verification fields, unknown filters/cursors, overlong text and invalid enums. Verify controlled errors, no mass assignment, no SQL/stack/token disclosure.
5. Withdraw invitations/remove members/suspend dealer in another profile; repeat stale authenticated and altered-client requests. Confirm no restored privilege.
6. Repeat sensitive requests to documented rate thresholds with QA; verify limits across phone/IP identities. Avoid abuse traffic on production.

Expected: Server authorization, tenant ownership, validation, revocation, rate policy and redaction enforce the rules independent of visible UI.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / screenshot / timestamp / browser: ____________________

### HUMAN-UAT-J014 — Production, deployment, backup and observability gates

Mapped tests: PROD-001 PROD-002 PROD-003 PROD-004 PROD-005 PROD-006 PROD-007 PROD-008 PROD-009 PROD-010 PROD-011 PROD-012 PROD-013 DEPLOY-001 DEPLOY-002 DEPLOY-003 DEPLOY-004 DEPLOY-005 DEPLOY-006 DEPLOY-007 DEPLOY-008 DEPLOY-009 DEPLOY-010 OBS-001 OBS-002 OBS-003 OBS-004 OBS-005 OBS-006 OBS-007 OBS-008 OBS-009 OBS-010 OBS-011 OBS-012. Priority: P1. Agent results: PASS: 4, FAIL: 1, BLOCKED: 30; consult each registry row.

Setup: QA/operations operator, isolated production-like deployment and restore target, configured test providers. No live production writes.

Steps:

1. Ask the operator to run isolated production startup validation with intended providers, then forbidden MinIO/fake OTP/Mailpit/dev auth/local seed options. Review acceptance/refusal summary without printing credentials. MinIO acceptance reproduces BUG-006.
2. Use the hosted UAT URL to exercise Google callback, OTP delivery, mail sender/links and object uploads/download privacy; compare endpoint/resource identities to the private approved deployment sheet.
3. Operator applies migrations to a copied pre-migration DB, including old-owner/SALES fixtures; compare users/dealers/listings/enquiries/documents and OWNER memberships before/after.
4. Operator performs a deliberately failed migration recovery and a real backup restore into a new isolated DB; you repeat login, roles, history, search and dealer lifecycle on the restored app.
5. Trigger an auth denial, role denial, suspension, permission change, listing/enquiry action and controlled 5xx. Ask operator for redacted correlation/audit/log/health evidence covering each action; no OTP/token/private signed URL should appear.
6. Operator checks production docs/internal/metrics exposure, client bundle secret scan and query index plans. Record missing tooling/resources as not verified, not PASS.

Expected: Intended production resources/providers only, forbidden local adapters/seeds rejected, deployment/restore preserves data and authorization, logs trace failures without secrets.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / screenshot / timestamp / browser: ____________________

### HUMAN-UAT-J015 — Recovery and races with QA coordination

Mapped tests: RECOVERY-001 RECOVERY-002 RECOVERY-003 RECOVERY-004 RECOVERY-005 RECOVERY-006 RECOVERY-007 RECOVERY-008 RECOVERY-009 RECOVERY-010 RECOVERY-011 RECOVERY-012 RECOVERY-013 CONCURRENCY-001 CONCURRENCY-002 CONCURRENCY-003 CONCURRENCY-004 CONCURRENCY-005 CONCURRENCY-006 CONCURRENCY-007 CONCURRENCY-008 CONCURRENCY-009 CONCURRENCY-010 CROSS-007 CROSS-016 CROSS-017 CROSS-019. Priority: P1. Agent results: PASS: 4, FAIL: 2, BLOCKED: 21; consult each registry row.

Setup: Disposable fixtures, two role profiles and operator-controlled failure/lock harness; never block shared or production DB.

Steps:

1. While you browse/save/enquire, operator disconnects only the isolated API/DB/storage/OTP/Google/mail service one at a time. Expect clear recoverable errors, no false success or partially authorized identity.
2. Restore each service and retry the same action once; compare record IDs/counts and history. Double-click, refresh/back and time out one request before retrying.
3. Two staff edit the same draft; two managers sell/reserve/withdraw; Admin review races edit/submit; dealer suspension races submit/enquiry. Operator releases controlled barriers and supplies final DB/audit state.
4. Two staff/managers change an enquiry simultaneously, two Admins review a dealer, two invitees accept and two legitimate customers enquire. Confirm valid state and retention of legitimate distinct records.
5. For BUG-005, operator holds the listing row lock, starts a MANAGER submit and proves the lock wait. You remove that MANAGER in OWNER Team and observe removal, then operator releases the lock. Expected submit denial/DRAFT; current baseline returns 200/PENDING_REVIEW.
6. Restart only the isolated server, reload persisted drafts/history and confirm identity/session state follows policy.

Expected: Safe retry and valid deterministic state; no stale privilege, duplicates, data loss or impossible lifecycle under controlled races/outages.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / screenshot / timestamp / browser: ____________________

## One verification ticket per canonical test

Execute P1 tickets before P2. Each ticket inherits the exact fixture IDs and methods from the priority journeys above and the private fixture sheet. A QA operator must prepare unavailable providers, failure states, races or restore fixtures before its human test can be performed. Mark the result only after the entire stated expected condition is observed.

### HUMAN-UAT-025 — AUTH-001

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J001.

Setup: Customer A/new phone; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login. Record the initial visible state and fixture resource IDs.
2. Use Send OTP, Verify and sign in, and the account menu Logout. QA supplies invalid/expired/used proofs and expired session fixtures for the relevant negative case.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: New customer successfully authenticates using configured OTP channel.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-026 — AUTH-002

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J001.

Setup: Customer A/new phone; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login. Record the initial visible state and fixture resource IDs.
2. Use Send OTP, Verify and sign in, and the account menu Logout. QA supplies invalid/expired/used proofs and expired session fixtures for the relevant negative case.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Existing customer logs in with verified phone.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-027 — AUTH-003

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J001.

Setup: Customer A/new phone; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login. Record the initial visible state and fixture resource IDs.
2. Use Send OTP, Verify and sign in, and the account menu Logout. QA supplies invalid/expired/used proofs and expired session fixtures for the relevant negative case.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Incorrect OTP rejected.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-028 — AUTH-004

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J001.

Setup: Customer A/new phone; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login. Record the initial visible state and fixture resource IDs.
2. Use Send OTP, Verify and sign in, and the account menu Logout. QA supplies invalid/expired/used proofs and expired session fixtures for the relevant negative case.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Expired OTP rejected.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-029 — AUTH-005

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J001.

Setup: Customer A/new phone; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login. Record the initial visible state and fixture resource IDs.
2. Use Send OTP, Verify and sign in, and the account menu Logout. QA supplies invalid/expired/used proofs and expired session fixtures for the relevant negative case.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Used OTP cannot be replayed.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-030 — AUTH-006

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J001.

Setup: Customer A/new phone; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login. Record the initial visible state and fixture resource IDs.
2. Use Send OTP, Verify and sign in, and the account menu Logout. QA supplies invalid/expired/used proofs and expired session fixtures for the relevant negative case.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OTP attempt limits enforced.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-031 — AUTH-007

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J001.

Setup: Customer A/new phone; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login. Record the initial visible state and fixture resource IDs.
2. Use Send OTP, Verify and sign in, and the account menu Logout. QA supplies invalid/expired/used proofs and expired session fixtures for the relevant negative case.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OTP resend limits enforced.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-032 — AUTH-008

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J001.

Setup: Customer A/new phone; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login. Record the initial visible state and fixture resource IDs.
2. Use Send OTP, Verify and sign in, and the account menu Logout. QA supplies invalid/expired/used proofs and expired session fixtures for the relevant negative case.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OTP provider failure gives recoverable UX.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-033 — AUTH-009

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J001.

Setup: Customer A/new phone; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login. Record the initial visible state and fixture resource IDs.
2. Use Send OTP, Verify and sign in, and the account menu Logout. QA supplies invalid/expired/used proofs and expired session fixtures for the relevant negative case.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Refresh during OTP does not corrupt account state.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-034 — AUTH-010

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J001.

Setup: Customer A/new phone; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login. Record the initial visible state and fixture resource IDs.
2. Use Send OTP, Verify and sign in, and the account menu Logout. QA supplies invalid/expired/used proofs and expired session fixtures for the relevant negative case.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Concurrent OTP attempts cannot authenticate wrong session.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-035 — AUTH-011

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J001.

Setup: Customer A/new phone; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login. Record the initial visible state and fixture resource IDs.
2. Use Send OTP, Verify and sign in, and the account menu Logout. QA supplies invalid/expired/used proofs and expired session fixtures for the relevant negative case.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Logout invalidates appropriate session.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-036 — AUTH-012

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J001.

Setup: Customer A/new phone; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login. Record the initial visible state and fixture resource IDs.
2. Use Send OTP, Verify and sign in, and the account menu Logout. QA supplies invalid/expired/used proofs and expired session fixtures for the relevant negative case.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Logout-all invalidates applicable sessions.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-037 — AUTH-013

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J001.

Setup: Customer A/new phone; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login. Record the initial visible state and fixture resource IDs.
2. Use Send OTP, Verify and sign in, and the account menu Logout. QA supplies invalid/expired/used proofs and expired session fixtures for the relevant negative case.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Expired session redirects gracefully.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-038 — AUTH-014

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Customer A/new phone; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login. Record the initial visible state and fixture resource IDs.
2. Use Send OTP, Verify and sign in, and the account menu Logout. QA supplies invalid/expired/used proofs and expired session fixtures for the relevant negative case.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Customer cannot access another customer's resources by changing IDs.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-039 — AUTH-015

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J001.

Setup: Customer A/new phone; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login. Record the initial visible state and fixture resource IDs.
2. Use Send OTP, Verify and sign in, and the account menu Logout. QA supplies invalid/expired/used proofs and expired session fixtures for the relevant negative case.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Authentication/session cookies use appropriate production security attributes.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-040 — CUSTOMER-001

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J001.

Setup: Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /saved and /enquiries. Record the initial visible state and fixture resource IDs.
2. Open both links through the account menu before and after the specified employer/listing change. Keep the same customer profile authenticated.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Authenticated customer sees correct account menu/avatar.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-041 — CUSTOMER-002

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J002.

Setup: Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /saved and /enquiries. Record the initial visible state and fixture resource IDs.
2. Open both links through the account menu before and after the specified employer/listing change. Keep the same customer profile authenticated.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Customer accesses Saved Cars.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-042 — CUSTOMER-003

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J002.

Setup: Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /saved and /enquiries. Record the initial visible state and fixture resource IDs.
2. Open both links through the account menu before and after the specified employer/listing change. Keep the same customer profile authenticated.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Customer accesses My Enquiries.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-043 — CUSTOMER-004

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J001.

Setup: Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /saved and /enquiries. Record the initial visible state and fixture resource IDs.
2. Open both links through the account menu before and after the specified employer/listing change. Keep the same customer profile authenticated.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Logout returns correct public state.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-044 — CUSTOMER-005

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J002.

Setup: Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /saved and /enquiries. Record the initial visible state and fixture resource IDs.
2. Open both links through the account menu before and after the specified employer/listing change. Keep the same customer profile authenticated.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Customer account remains usable when an enquiry's dealer changes operational state.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-045 — CUSTOMER-006

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J002.

Setup: Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /saved and /enquiries. Record the initial visible state and fixture resource IDs.
2. Open both links through the account menu before and after the specified employer/listing change. Keep the same customer profile authenticated.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Customer account remains usable if customer also becomes dealer member.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-046 — CUSTOMER-007

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J002.

Setup: Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /saved and /enquiries. Record the initial visible state and fixture resource IDs.
2. Open both links through the account menu before and after the specified employer/listing change. Keep the same customer profile authenticated.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Customer account remains usable after dealer membership revocation.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-047 — CUSTOMER-008

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J002.

Setup: Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /saved and /enquiries. Record the initial visible state and fixture resource IDs.
2. Open both links through the account menu before and after the specified employer/listing change. Keep the same customer profile authenticated.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Revoking dealer membership does not revoke customer authentication/account.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-048 — CUSTOMER-009

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J002.

Setup: Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /saved and /enquiries. Record the initial visible state and fixture resource IDs.
2. Open both links through the account menu before and after the specified employer/listing change. Keep the same customer profile authenticated.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Suspending dealership does not suspend personal customer capabilities of its members.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-049 — CUSTOMER-010

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J002.

Setup: Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /saved and /enquiries. Record the initial visible state and fixture resource IDs.
2. Open both links through the account menu before and after the specified employer/listing change. Keep the same customer profile authenticated.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Customer and dealership authorization remain independent.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-050 — SAVED-001

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J002.

Setup: Customer A/B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /cars → save heart → /saved. Record the initial visible state and fixture resource IDs.
2. Save/remove the specified fixture car, then apply the exact lifecycle or session change from the test. Compare the same saved row and another customer profile.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Customer saves ACTIVE car.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-051 — SAVED-002

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J002.

Setup: Customer A/B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /cars → save heart → /saved. Record the initial visible state and fixture resource IDs.
2. Save/remove the specified fixture car, then apply the exact lifecycle or session change from the test. Compare the same saved row and another customer profile.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Anonymous save triggers intended authentication flow.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-052 — SAVED-003

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J002.

Setup: Customer A/B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /cars → save heart → /saved. Record the initial visible state and fixture resource IDs.
2. Save/remove the specified fixture car, then apply the exact lifecycle or session change from the test. Compare the same saved row and another customer profile.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Customer unsaves car.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-053 — SAVED-004

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J002.

Setup: Customer A/B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /cars → save heart → /saved. Record the initial visible state and fixture resource IDs.
2. Save/remove the specified fixture car, then apply the exact lifecycle or session change from the test. Compare the same saved row and another customer profile.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Duplicate save does not create duplicate records.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-054 — SAVED-005

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J002.

Setup: Customer A/B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /cars → save heart → /saved. Record the initial visible state and fixture resource IDs.
2. Save/remove the specified fixture car, then apply the exact lifecycle or session change from the test. Compare the same saved row and another customer profile.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Saved cars persist through logout/login.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-055 — SAVED-006

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J002.

Setup: Customer A/B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /cars → save heart → /saved. Record the initial visible state and fixture resource IDs.
2. Save/remove the specified fixture car, then apply the exact lifecycle or session change from the test. Compare the same saved row and another customer profile.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: RESERVED saved car follows intended unavailable state.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-056 — SAVED-007

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J002.

Setup: Customer A/B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /cars → save heart → /saved. Record the initial visible state and fixture resource IDs.
2. Save/remove the specified fixture car, then apply the exact lifecycle or session change from the test. Compare the same saved row and another customer profile.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: SOLD saved car follows intended behavior without corrupting history.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-057 — SAVED-008

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J002.

Setup: Customer A/B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /cars → save heart → /saved. Record the initial visible state and fixture resource IDs.
2. Save/remove the specified fixture car, then apply the exact lifecycle or session change from the test. Compare the same saved row and another customer profile.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: WITHDRAWN saved car follows intended unavailable behavior.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-058 — SAVED-009

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J002.

Setup: Customer A/B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /cars → save heart → /saved. Record the initial visible state and fixture resource IDs.
2. Save/remove the specified fixture car, then apply the exact lifecycle or session change from the test. Compare the same saved row and another customer profile.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Removed/moderated-down listing does not break Saved Cars.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-059 — SAVED-010

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J002.

Setup: Customer A/B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /cars → save heart → /saved. Record the initial visible state and fixture resource IDs.
2. Save/remove the specified fixture car, then apply the exact lifecycle or session change from the test. Compare the same saved row and another customer profile.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Customer cannot access another customer's saved records.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-060 — ENQ-CREATE-001

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: Customer A; Dealer A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /car/{publicSlug} → Enquire now. Record the initial visible state and fixture resource IDs.
2. Open/cancel/reopen the form, inspect verified identity and submit the appropriate message. Use unavailable fixture slugs or altered collection requests for negative cases; compare all three account views.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Customer enquires about ACTIVE vehicle.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-061 — ENQ-CREATE-002

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: Customer A; Dealer A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /car/{publicSlug} → Enquire now. Record the initial visible state and fixture resource IDs.
2. Open/cancel/reopen the form, inspect verified identity and submit the appropriate message. Use unavailable fixture slugs or altered collection requests for negative cases; compare all three account views.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Anonymous Enquire initiates required authentication/phone verification.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-062 — ENQ-CREATE-003

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: Customer A; Dealer A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /car/{publicSlug} → Enquire now. Record the initial visible state and fixture resource IDs.
2. Open/cancel/reopen the form, inspect verified identity and submit the appropriate message. Use unavailable fixture slugs or altered collection requests for negative cases; compare all three account views.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Verified customer information prefills correctly.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-063 — ENQ-CREATE-004

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: Customer A; Dealer A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /car/{publicSlug} → Enquire now. Record the initial visible state and fixture resource IDs.
2. Open/cancel/reopen the form, inspect verified identity and submit the appropriate message. Use unavailable fixture slugs or altered collection requests for negative cases; compare all three account views.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Enquiry submits without optional description.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-064 — ENQ-CREATE-005

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: Customer A; Dealer A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /car/{publicSlug} → Enquire now. Record the initial visible state and fixture resource IDs.
2. Open/cancel/reopen the form, inspect verified identity and submit the appropriate message. Use unavailable fixture slugs or altered collection requests for negative cases; compare all three account views.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Enquiry submits with description.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-065 — ENQ-CREATE-006

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: Customer A; Dealer A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /car/{publicSlug} → Enquire now. Record the initial visible state and fixture resource IDs.
2. Open/cancel/reopen the form, inspect verified identity and submit the appropriate message. Use unavailable fixture slugs or altered collection requests for negative cases; compare all three account views.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Invalid enquiry input rejected server-side.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-066 — ENQ-CREATE-007

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: Customer A; Dealer A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /car/{publicSlug} → Enquire now. Record the initial visible state and fixture resource IDs.
2. Open/cancel/reopen the form, inspect verified identity and submit the appropriate message. Use unavailable fixture slugs or altered collection requests for negative cases; compare all three account views.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: SOLD vehicle cannot receive new enquiry.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-067 — ENQ-CREATE-008

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: Customer A; Dealer A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /car/{publicSlug} → Enquire now. Record the initial visible state and fixture resource IDs.
2. Open/cancel/reopen the form, inspect verified identity and submit the appropriate message. Use unavailable fixture slugs or altered collection requests for negative cases; compare all three account views.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: WITHDRAWN vehicle cannot receive new enquiry.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-068 — ENQ-CREATE-009

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: Customer A; Dealer A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /car/{publicSlug} → Enquire now. Record the initial visible state and fixture resource IDs.
2. Open/cancel/reopen the form, inspect verified identity and submit the appropriate message. Use unavailable fixture slugs or altered collection requests for negative cases; compare all three account views.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Non-public/moderation listing cannot receive enquiry.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-069 — ENQ-CREATE-010

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: Customer A; Dealer A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /car/{publicSlug} → Enquire now. Record the initial visible state and fixture resource IDs.
2. Open/cancel/reopen the form, inspect verified identity and submit the appropriate message. Use unavailable fixture slugs or altered collection requests for negative cases; compare all three account views.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: RESERVED vehicle enquiry follows defined behavior.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-070 — ENQ-CREATE-011

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: Customer A; Dealer A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /car/{publicSlug} → Enquire now. Record the initial visible state and fixture resource IDs.
2. Open/cancel/reopen the form, inspect verified identity and submit the appropriate message. Use unavailable fixture slugs or altered collection requests for negative cases; compare all three account views.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Vehicle becoming SOLD during enquiry submission is handled safely.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-071 — ENQ-CREATE-012

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: Customer A; Dealer A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /car/{publicSlug} → Enquire now. Record the initial visible state and fixture resource IDs.
2. Open/cancel/reopen the form, inspect verified identity and submit the appropriate message. Use unavailable fixture slugs or altered collection requests for negative cases; compare all three account views.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Rapid duplicate submissions do not create unintended duplicate leads.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-072 — ENQ-CREATE-013

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: Customer A; Dealer A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /car/{publicSlug} → Enquire now. Record the initial visible state and fixture resource IDs.
2. Open/cancel/reopen the form, inspect verified identity and submit the appropriate message. Use unavailable fixture slugs or altered collection requests for negative cases; compare all three account views.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Successful enquiry appears in My Enquiries.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-073 — ENQ-CREATE-014

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: Customer A; Dealer A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /car/{publicSlug} → Enquire now. Record the initial visible state and fixture resource IDs.
2. Open/cancel/reopen the form, inspect verified identity and submit the appropriate message. Use unavailable fixture slugs or altered collection requests for negative cases; compare all three account views.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Successful enquiry appears in correct dealer Enquiries.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-074 — ENQ-CREATE-015

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: Customer A; Dealer A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /car/{publicSlug} → Enquire now. Record the initial visible state and fixture resource IDs.
2. Open/cancel/reopen the form, inspect verified identity and submit the appropriate message. Use unavailable fixture slugs or altered collection requests for negative cases; compare all three account views.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Successful enquiry appears in Admin tracking.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-075 — ENQ-CREATE-016

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: Customer A; Dealer A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /car/{publicSlug} → Enquire now. Record the initial visible state and fixture resource IDs.
2. Open/cancel/reopen the form, inspect verified identity and submit the appropriate message. Use unavailable fixture slugs or altered collection requests for negative cases; compare all three account views.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Customer/dealer/Admin enquiry data remains consistent.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-076 — ENQ-CREATE-017

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: Customer A; Dealer A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /car/{publicSlug} → Enquire now. Record the initial visible state and fixture resource IDs.
2. Open/cancel/reopen the form, inspect verified identity and submit the appropriate message. Use unavailable fixture slugs or altered collection requests for negative cases; compare all three account views.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer A cannot view Dealer B enquiries.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-077 — ENQ-CREATE-018

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: Customer A; Dealer A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /car/{publicSlug} → Enquire now. Record the initial visible state and fixture resource IDs.
2. Open/cancel/reopen the form, inspect verified identity and submit the appropriate message. Use unavailable fixture slugs or altered collection requests for negative cases; compare all three account views.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Customer A cannot view Customer B enquiries.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-078 — ENQ-LIFE-001

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: STAFF/MANAGER/OWNER A; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/enquiries. Record the initial visible state and fixture resource IDs.
2. Choose New, Contacted or Closed tab for the fixture, perform the allowed status action, then refresh customer /enquiries and Admin detail. For forbidden moves use the same identity in the API collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: New enquiry begins in correct initial state.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-079 — ENQ-LIFE-002

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: STAFF/MANAGER/OWNER A; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/enquiries. Record the initial visible state and fixture resource IDs.
2. Choose New, Contacted or Closed tab for the fixture, perform the allowed status action, then refresh customer /enquiries and Admin detail. For forbidden moves use the same identity in the API collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF views dealership enquiries.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-080 — ENQ-LIFE-003

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: STAFF/MANAGER/OWNER A; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/enquiries. Record the initial visible state and fixture resource IDs.
2. Choose New, Contacted or Closed tab for the fixture, perform the allowed status action, then refresh customer /enquiries and Admin detail. For forbidden moves use the same identity in the API collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF can mark NEW → CONTACTED.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-081 — ENQ-LIFE-004

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: STAFF/MANAGER/OWNER A; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/enquiries. Record the initial visible state and fixture resource IDs.
2. Choose New, Contacted or Closed tab for the fixture, perform the allowed status action, then refresh customer /enquiries and Admin detail. For forbidden moves use the same identity in the API collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF cannot close enquiry.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-082 — ENQ-LIFE-005

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: STAFF/MANAGER/OWNER A; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/enquiries. Record the initial visible state and fixture resource IDs.
2. Choose New, Contacted or Closed tab for the fixture, perform the allowed status action, then refresh customer /enquiries and Admin detail. For forbidden moves use the same identity in the API collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER can mark CONTACTED.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-083 — ENQ-LIFE-006

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: STAFF/MANAGER/OWNER A; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/enquiries. Record the initial visible state and fixture resource IDs.
2. Choose New, Contacted or Closed tab for the fixture, perform the allowed status action, then refresh customer /enquiries and Admin detail. For forbidden moves use the same identity in the API collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER can close enquiry.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-084 — ENQ-LIFE-007

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: STAFF/MANAGER/OWNER A; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/enquiries. Record the initial visible state and fixture resource IDs.
2. Choose New, Contacted or Closed tab for the fixture, perform the allowed status action, then refresh customer /enquiries and Admin detail. For forbidden moves use the same identity in the API collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER can perform all intended transitions.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-085 — ENQ-LIFE-008

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: STAFF/MANAGER/OWNER A; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/enquiries. Record the initial visible state and fixture resource IDs.
2. Choose New, Contacted or Closed tab for the fixture, perform the allowed status action, then refresh customer /enquiries and Admin detail. For forbidden moves use the same identity in the API collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: CONTACTED records actor/time.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-086 — ENQ-LIFE-009

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: STAFF/MANAGER/OWNER A; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/enquiries. Record the initial visible state and fixture resource IDs.
2. Choose New, Contacted or Closed tab for the fixture, perform the allowed status action, then refresh customer /enquiries and Admin detail. For forbidden moves use the same identity in the API collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: CLOSED records actor/time.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-087 — ENQ-LIFE-010

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: STAFF/MANAGER/OWNER A; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/enquiries. Record the initial visible state and fixture resource IDs.
2. Choose New, Contacted or Closed tab for the fixture, perform the allowed status action, then refresh customer /enquiries and Admin detail. For forbidden moves use the same identity in the API collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Invalid transitions rejected server-side.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-088 — ENQ-LIFE-011

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: STAFF/MANAGER/OWNER A; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/enquiries. Record the initial visible state and fixture resource IDs.
2. Choose New, Contacted or Closed tab for the fixture, perform the allowed status action, then refresh customer /enquiries and Admin detail. For forbidden moves use the same identity in the API collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Direct API cannot bypass enquiry permissions.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-089 — ENQ-LIFE-012

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: STAFF/MANAGER/OWNER A; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/enquiries. Record the initial visible state and fixture resource IDs.
2. Choose New, Contacted or Closed tab for the fixture, perform the allowed status action, then refresh customer /enquiries and Admin detail. For forbidden moves use the same identity in the API collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Concurrent enquiry updates produce valid deterministic state.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-090 — ENQ-LIFE-013

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: STAFF/MANAGER/OWNER A; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/enquiries. Record the initial visible state and fixture resource IDs.
2. Choose New, Contacted or Closed tab for the fixture, perform the allowed status action, then refresh customer /enquiries and Admin detail. For forbidden moves use the same identity in the API collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Customer history survives CONTACTED.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-091 — ENQ-LIFE-014

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: STAFF/MANAGER/OWNER A; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/enquiries. Record the initial visible state and fixture resource IDs.
2. Choose New, Contacted or Closed tab for the fixture, perform the allowed status action, then refresh customer /enquiries and Admin detail. For forbidden moves use the same identity in the API collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Customer history survives CLOSED.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-092 — ENQ-LIFE-015

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: STAFF/MANAGER/OWNER A; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/enquiries. Record the initial visible state and fixture resource IDs.
2. Choose New, Contacted or Closed tab for the fixture, perform the allowed status action, then refresh customer /enquiries and Admin detail. For forbidden moves use the same identity in the API collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: History survives associated vehicle SOLD.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-093 — ENQ-LIFE-016

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: STAFF/MANAGER/OWNER A; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/enquiries. Record the initial visible state and fixture resource IDs.
2. Choose New, Contacted or Closed tab for the fixture, perform the allowed status action, then refresh customer /enquiries and Admin detail. For forbidden moves use the same identity in the API collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: History survives WITHDRAWN.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-094 — ENQ-LIFE-017

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: STAFF/MANAGER/OWNER A; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/enquiries. Record the initial visible state and fixture resource IDs.
2. Choose New, Contacted or Closed tab for the fixture, perform the allowed status action, then refresh customer /enquiries and Admin detail. For forbidden moves use the same identity in the API collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: History survives RESERVED.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-095 — ENQ-LIFE-018

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: STAFF/MANAGER/OWNER A; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/enquiries. Record the initial visible state and fixture resource IDs.
2. Choose New, Contacted or Closed tab for the fixture, perform the allowed status action, then refresh customer /enquiries and Admin detail. For forbidden moves use the same identity in the API collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Historical enquiry remains usable when listing is no longer public.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-096 — ENQ-LIFE-019

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: STAFF/MANAGER/OWNER A; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/enquiries. Record the initial visible state and fixture resource IDs.
2. Choose New, Contacted or Closed tab for the fixture, perform the allowed status action, then refresh customer /enquiries and Admin detail. For forbidden moves use the same identity in the API collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer suspension does not delete enquiry history.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-097 — ENQ-LIFE-020

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: STAFF/MANAGER/OWNER A; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/enquiries. Record the initial visible state and fixture resource IDs.
2. Choose New, Contacted or Closed tab for the fixture, perform the allowed status action, then refresh customer /enquiries and Admin detail. For forbidden moves use the same identity in the API collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Member removal does not delete handled enquiries.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-098 — ENQ-LIFE-021

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J006.

Setup: STAFF/MANAGER/OWNER A; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/enquiries. Record the initial visible state and fixture resource IDs.
2. Choose New, Contacted or Closed tab for the fixture, perform the allowed status action, then refresh customer /enquiries and Admin detail. For forbidden moves use the same identity in the API collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Historical actor remains attributable after member removal.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-099 — ONBOARD-001

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J003.

Setup: New dealer applicant; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer onboarding entry. Record the initial visible state and fixture resource IDs.
2. Complete the required identity, business and document steps; leave the specified prerequisite missing or change the document/identity fixture for negative tests. Refresh/resume at the indicated step.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: New eligible user begins dealer onboarding.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-100 — ONBOARD-002

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J003.

Setup: New dealer applicant; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer onboarding entry. Record the initial visible state and fixture resource IDs.
2. Complete the required identity, business and document steps; leave the specified prerequisite missing or change the document/identity fixture for negative tests. Refresh/resume at the indicated step.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Repeated submissions do not create duplicate dealership.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-101 — ONBOARD-003

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J003.

Setup: New dealer applicant; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer onboarding entry. Record the initial visible state and fixture resource IDs.
2. Complete the required identity, business and document steps; leave the specified prerequisite missing or change the document/identity fixture for negative tests. Refresh/resume at the indicated step.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer phone verification works.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-102 — ONBOARD-004

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J003.

Setup: New dealer applicant; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer onboarding entry. Record the initial visible state and fixture resource IDs.
2. Complete the required identity, business and document steps; leave the specified prerequisite missing or change the document/identity fixture for negative tests. Refresh/resume at the indicated step.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Google linking/authentication works according to current architecture.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-103 — ONBOARD-005

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J003.

Setup: New dealer applicant; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer onboarding entry. Record the initial visible state and fixture resource IDs.
2. Complete the required identity, business and document steps; leave the specified prerequisite missing or change the document/identity fixture for negative tests. Refresh/resume at the indicated step.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Phone/Google link to correct human rather than duplicate users.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-104 — ONBOARD-006

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J003.

Setup: New dealer applicant; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer onboarding entry. Record the initial visible state and fixture resource IDs.
2. Complete the required identity, business and document steps; leave the specified prerequisite missing or change the document/identity fixture for negative tests. Refresh/resume at the indicated step.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Incomplete onboarding can resume.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-105 — ONBOARD-007

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J003.

Setup: New dealer applicant; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer onboarding entry. Record the initial visible state and fixture resource IDs.
2. Complete the required identity, business and document steps; leave the specified prerequisite missing or change the document/identity fixture for negative tests. Refresh/resume at the indicated step.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Refresh preserves intended onboarding progress.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-106 — ONBOARD-008

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J003.

Setup: New dealer applicant; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer onboarding entry. Record the initial visible state and fixture resource IDs.
2. Complete the required identity, business and document steps; leave the specified prerequisite missing or change the document/identity fixture for negative tests. Refresh/resume at the indicated step.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Logout/login returns draft/review dealer to correct state.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-107 — ONBOARD-009

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J003.

Setup: New dealer applicant; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer onboarding entry. Record the initial visible state and fixture resource IDs.
2. Complete the required identity, business and document steps; leave the specified prerequisite missing or change the document/identity fixture for negative tests. Refresh/resume at the indicated step.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Required dealership fields cannot be skipped.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-108 — ONBOARD-010

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J003.

Setup: New dealer applicant; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer onboarding entry. Record the initial visible state and fixture resource IDs.
2. Complete the required identity, business and document steps; leave the specified prerequisite missing or change the document/identity fixture for negative tests. Refresh/resume at the indicated step.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Required dealer documents cannot be skipped.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-109 — ONBOARD-011

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J003.

Setup: New dealer applicant; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer onboarding entry. Record the initial visible state and fixture resource IDs.
2. Complete the required identity, business and document steps; leave the specified prerequisite missing or change the document/identity fixture for negative tests. Refresh/resume at the indicated step.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Invalid document type/size rejected.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-110 — ONBOARD-012

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J003.

Setup: New dealer applicant; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer onboarding entry. Record the initial visible state and fixture resource IDs.
2. Complete the required identity, business and document steps; leave the specified prerequisite missing or change the document/identity fixture for negative tests. Refresh/resume at the indicated step.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Documents remain associated with correct dealership.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-111 — ONBOARD-013

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J003.

Setup: New dealer applicant; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer onboarding entry. Record the initial visible state and fixture resource IDs.
2. Complete the required identity, business and document steps; leave the specified prerequisite missing or change the document/identity fixture for negative tests. Refresh/resume at the indicated step.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer cannot retrieve another dealer's verification documents.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-112 — ONBOARD-014

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J003.

Setup: New dealer applicant; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer onboarding entry. Record the initial visible state and fixture resource IDs.
2. Complete the required identity, business and document steps; leave the specified prerequisite missing or change the document/identity fixture for negative tests. Refresh/resume at the indicated step.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Completed onboarding enters correct review state.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-113 — ONBOARD-015

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J003.

Setup: New dealer applicant; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer onboarding entry. Record the initial visible state and fixture resource IDs.
2. Complete the required identity, business and document steps; leave the specified prerequisite missing or change the document/identity fixture for negative tests. Refresh/resume at the indicated step.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer cannot self-approve.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-114 — ONBOARD-016

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J003.

Setup: New dealer applicant; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer onboarding entry. Record the initial visible state and fixture resource IDs.
2. Complete the required identity, business and document steps; leave the specified prerequisite missing or change the document/identity fixture for negative tests. Refresh/resume at the indicated step.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Direct APIs cannot bypass onboarding requirements.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-115 — ONBOARD-017

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J003.

Setup: New dealer applicant; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer onboarding entry. Record the initial visible state and fixture resource IDs.
2. Complete the required identity, business and document steps; leave the specified prerequisite missing or change the document/identity fixture for negative tests. Refresh/resume at the indicated step.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Unverified dealer cannot publicly list vehicles.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-116 — ONBOARD-018

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J003.

Setup: New dealer applicant; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer onboarding entry. Record the initial visible state and fixture resource IDs.
2. Complete the required identity, business and document steps; leave the specified prerequisite missing or change the document/identity fixture for negative tests. Refresh/resume at the indicated step.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Duplicate identity handling follows intended linking rules.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-117 — VERIFY-001

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J004.

Setup: Admin; applicant; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers. Record the initial visible state and fixture resource IDs.
2. Open the relevant complete/incomplete application and execute the indicated approval/rejection/changes decision. Applicant refreshes its state. Direct approval uses POST /v1/admin/dealers/{dealerId}/approve with {}.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin sees submitted dealer application.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-118 — VERIFY-002

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J004.

Setup: Admin; applicant; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers. Record the initial visible state and fixture resource IDs.
2. Open the relevant complete/incomplete application and execute the indicated approval/rejection/changes decision. Applicant refreshes its state. Direct approval uses POST /v1/admin/dealers/{dealerId}/approve with {}.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin sees required dealer information/documents.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-119 — VERIFY-003

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J004.

Setup: Admin; applicant; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers. Record the initial visible state and fixture resource IDs.
2. Open the relevant complete/incomplete application and execute the indicated approval/rejection/changes decision. Applicant refreshes its state. Direct approval uses POST /v1/admin/dealers/{dealerId}/approve with {}.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin approves valid dealership.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-120 — VERIFY-004

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J004.

Setup: Admin; applicant; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers. Record the initial visible state and fixture resource IDs.
2. Open the relevant complete/incomplete application and execute the indicated approval/rejection/changes decision. Applicant refreshes its state. Direct approval uses POST /v1/admin/dealers/{dealerId}/approve with {}.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Approved dealership enters correct verified/active state.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-121 — VERIFY-005

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J004.

Setup: Admin; applicant; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers. Record the initial visible state and fixture resource IDs.
2. Open the relevant complete/incomplete application and execute the indicated approval/rejection/changes decision. Applicant refreshes its state. Direct approval uses POST /v1/admin/dealers/{dealerId}/approve with {}.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer gains intended capabilities only after approval.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-122 — VERIFY-006

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J004.

Setup: Admin; applicant; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers. Record the initial visible state and fixture resource IDs.
2. Open the relevant complete/incomplete application and execute the indicated approval/rejection/changes decision. Applicant refreshes its state. Direct approval uses POST /v1/admin/dealers/{dealerId}/approve with {}.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin rejects dealer.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-123 — VERIFY-007

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J004.

Setup: Admin; applicant; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers. Record the initial visible state and fixture resource IDs.
2. Open the relevant complete/incomplete application and execute the indicated approval/rejection/changes decision. Applicant refreshes its state. Direct approval uses POST /v1/admin/dealers/{dealerId}/approve with {}.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Rejected dealer gets correct state/remediation path.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-124 — VERIFY-008

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J004.

Setup: Admin; applicant; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers. Record the initial visible state and fixture resource IDs.
2. Open the relevant complete/incomplete application and execute the indicated approval/rejection/changes decision. Applicant refreshes its state. Direct approval uses POST /v1/admin/dealers/{dealerId}/approve with {}.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Rejected dealer cannot access verified-only features.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-125 — VERIFY-009

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J004.

Setup: Admin; applicant; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers. Record the initial visible state and fixture resource IDs.
2. Open the relevant complete/incomplete application and execute the indicated approval/rejection/changes decision. Applicant refreshes its state. Direct approval uses POST /v1/admin/dealers/{dealerId}/approve with {}.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Rejected dealer can correct/resubmit where supported.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-126 — VERIFY-010

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J004.

Setup: Admin; applicant; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers. Record the initial visible state and fixture resource IDs.
2. Open the relevant complete/incomplete application and execute the indicated approval/rejection/changes decision. Applicant refreshes its state. Direct approval uses POST /v1/admin/dealers/{dealerId}/approve with {}.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Resubmission enters correct review state.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-127 — VERIFY-011

Priority: P1. Agent result: FAIL. Bug: BUG-002. Journey: HUMAN-UAT-J004.

Setup: Admin; applicant; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers. Record the initial visible state and fixture resource IDs.
2. Open the relevant complete/incomplete application and execute the indicated approval/rejection/changes decision. Applicant refreshes its state. Direct approval uses POST /v1/admin/dealers/{dealerId}/approve with {}.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Incomplete dealer cannot be approved through direct API.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-128 — VERIFY-012

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J004.

Setup: Admin; applicant; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers. Record the initial visible state and fixture resource IDs.
2. Open the relevant complete/incomplete application and execute the indicated approval/rejection/changes decision. Applicant refreshes its state. Direct approval uses POST /v1/admin/dealers/{dealerId}/approve with {}.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Concurrent Admin review cannot corrupt verification state.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-129 — VERIFY-013

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J004.

Setup: Admin; applicant; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers. Record the initial visible state and fixture resource IDs.
2. Open the relevant complete/incomplete application and execute the indicated approval/rejection/changes decision. Applicant refreshes its state. Direct approval uses POST /v1/admin/dealers/{dealerId}/approve with {}.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Verification transitions are audit logged.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-130 — VERIFY-014

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J004.

Setup: Admin; applicant; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers. Record the initial visible state and fixture resource IDs.
2. Open the relevant complete/incomplete application and execute the indicated approval/rejection/changes decision. Applicant refreshes its state. Direct approval uses POST /v1/admin/dealers/{dealerId}/approve with {}.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Existing dealer data/listings behave correctly if verification status later changes.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-131 — DEALER-LIFE-001

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Admin; Dealer A member; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers and /dealer. Record the initial visible state and fixture resource IDs.
2. Suspend/reinstate the disposable dealer with a reason. In the already-open member/customer/anonymous profiles retry operations, public URLs and personal/history pages; compare fixture IDs/counts.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: ACTIVE verified dealer operates normally.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-132 — DEALER-LIFE-002

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Admin; Dealer A member; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers and /dealer. Record the initial visible state and fixture resource IDs.
2. Suspend/reinstate the disposable dealer with a reason. In the already-open member/customer/anonymous profiles retry operations, public URLs and personal/history pages; compare fixture IDs/counts.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin suspends ACTIVE dealer.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-133 — DEALER-LIFE-003

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Admin; Dealer A member; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers and /dealer. Record the initial visible state and fixture resource IDs.
2. Suspend/reinstate the disposable dealer with a reason. In the already-open member/customer/anonymous profiles retry operations, public URLs and personal/history pages; compare fixture IDs/counts.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Suspended dealer immediately loses prohibited operations.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-134 — DEALER-LIFE-004

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Admin; Dealer A member; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers and /dealer. Record the initial visible state and fixture resource IDs.
2. Suspend/reinstate the disposable dealer with a reason. In the already-open member/customer/anonymous profiles retry operations, public URLs and personal/history pages; compare fixture IDs/counts.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Existing session cannot bypass suspension.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-135 — DEALER-LIFE-005

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Admin; Dealer A member; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers and /dealer. Record the initial visible state and fixture resource IDs.
2. Suspend/reinstate the disposable dealer with a reason. In the already-open member/customer/anonymous profiles retry operations, public URLs and personal/history pages; compare fixture IDs/counts.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Suspended dealer public profile follows defined policy.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-136 — DEALER-LIFE-006

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Admin; Dealer A member; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers and /dealer. Record the initial visible state and fixture resource IDs.
2. Suspend/reinstate the disposable dealer with a reason. In the already-open member/customer/anonymous profiles retry operations, public URLs and personal/history pages; compare fixture IDs/counts.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: ACTIVE listings of suspended dealer follow explicitly defined visibility policy.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-137 — DEALER-LIFE-007

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Admin; Dealer A member; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers and /dealer. Record the initial visible state and fixture resource IDs.
2. Suspend/reinstate the disposable dealer with a reason. In the already-open member/customer/anonymous profiles retry operations, public URLs and personal/history pages; compare fixture IDs/counts.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: RESERVED listings of suspended dealer remain consistent.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-138 — DEALER-LIFE-008

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Admin; Dealer A member; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers and /dealer. Record the initial visible state and fixture resource IDs.
2. Suspend/reinstate the disposable dealer with a reason. In the already-open member/customer/anonymous profiles retry operations, public URLs and personal/history pages; compare fixture IDs/counts.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Existing enquiries survive suspension.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-139 — DEALER-LIFE-009

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Admin; Dealer A member; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers and /dealer. Record the initial visible state and fixture resource IDs.
2. Suspend/reinstate the disposable dealer with a reason. In the already-open member/customer/anonymous profiles retry operations, public URLs and personal/history pages; compare fixture IDs/counts.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Customer enquiry history survives dealer suspension.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-140 — DEALER-LIFE-010

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Admin; Dealer A member; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers and /dealer. Record the initial visible state and fixture resource IDs.
2. Suspend/reinstate the disposable dealer with a reason. In the already-open member/customer/anonymous profiles retry operations, public URLs and personal/history pages; compare fixture IDs/counts.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Saved cars from suspended dealer remain non-broken.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-141 — DEALER-LIFE-011

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Admin; Dealer A member; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers and /dealer. Record the initial visible state and fixture resource IDs.
2. Suspend/reinstate the disposable dealer with a reason. In the already-open member/customer/anonymous profiles retry operations, public URLs and personal/history pages; compare fixture IDs/counts.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer members cannot bypass suspension through valid membership.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-142 — DEALER-LIFE-012

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Admin; Dealer A member; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers and /dealer. Record the initial visible state and fixture resource IDs.
2. Suspend/reinstate the disposable dealer with a reason. In the already-open member/customer/anonymous profiles retry operations, public URLs and personal/history pages; compare fixture IDs/counts.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer members retain personal customer capabilities.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-143 — DEALER-LIFE-013

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Admin; Dealer A member; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers and /dealer. Record the initial visible state and fixture resource IDs.
2. Suspend/reinstate the disposable dealer with a reason. In the already-open member/customer/anonymous profiles retry operations, public URLs and personal/history pages; compare fixture IDs/counts.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Reinstatement restores only intended dealer capabilities/data.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-144 — DEALER-LIFE-014

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Admin; Dealer A member; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers and /dealer. Record the initial visible state and fixture resource IDs.
2. Suspend/reinstate the disposable dealer with a reason. In the already-open member/customer/anonymous profiles retry operations, public URLs and personal/history pages; compare fixture IDs/counts.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Reinstatement creates no duplicate listings/memberships/enquiries.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-145 — DEALER-LIFE-015

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Admin; Dealer A member; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers and /dealer. Record the initial visible state and fixture resource IDs.
2. Suspend/reinstate the disposable dealer with a reason. In the already-open member/customer/anonymous profiles retry operations, public URLs and personal/history pages; compare fixture IDs/counts.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Hidden listings restore only according to defined lifecycle policy.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-146 — DEALER-LIFE-016

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Admin; Dealer A member; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers and /dealer. Record the initial visible state and fixture resource IDs.
2. Suspend/reinstate the disposable dealer with a reason. In the already-open member/customer/anonymous profiles retry operations, public URLs and personal/history pages; compare fixture IDs/counts.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Suspension/reinstatement audit logged.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-147 — DEALER-LIFE-017

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Admin; Dealer A member; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers and /dealer. Record the initial visible state and fixture resource IDs.
2. Suspend/reinstate the disposable dealer with a reason. In the already-open member/customer/anonymous profiles retry operations, public URLs and personal/history pages; compare fixture IDs/counts.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Permanent dealer deactivation preserves required historical data.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-148 — DEALER-LIFE-018

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Admin; Dealer A member; Customer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers and /dealer. Record the initial visible state and fixture resource IDs.
2. Suspend/reinstate the disposable dealer with a reason. In the already-open member/customer/anonymous profiles retry operations, public URLs and personal/history pages; compare fixture IDs/counts.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Direct API cannot bypass dealer lifecycle restrictions.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-149 — LISTING-CREATE-001

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: Specified OWNER/MANAGER/STAFF A; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/vehicles/new and /dealer/inventory. Record the initial visible state and fixture resource IDs.
2. Enter a fresh registration, Continue, enter the specified valid/invalid vehicle fields and Save draft. Reopen the same draft after the indicated navigation or membership change; compare ownership/creator via the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER creates draft.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-150 — LISTING-CREATE-002

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: Specified OWNER/MANAGER/STAFF A; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/vehicles/new and /dealer/inventory. Record the initial visible state and fixture resource IDs.
2. Enter a fresh registration, Continue, enter the specified valid/invalid vehicle fields and Save draft. Reopen the same draft after the indicated navigation or membership change; compare ownership/creator via the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER creates draft.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-151 — LISTING-CREATE-003

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: Specified OWNER/MANAGER/STAFF A; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/vehicles/new and /dealer/inventory. Record the initial visible state and fixture resource IDs.
2. Enter a fresh registration, Continue, enter the specified valid/invalid vehicle fields and Save draft. Reopen the same draft after the indicated navigation or membership change; compare ownership/creator via the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF creates draft.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-152 — LISTING-CREATE-004

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: Specified OWNER/MANAGER/STAFF A; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/vehicles/new and /dealer/inventory. Record the initial visible state and fixture resource IDs.
2. Enter a fresh registration, Continue, enter the specified valid/invalid vehicle fields and Save draft. Reopen the same draft after the indicated navigation or membership change; compare ownership/creator via the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Draft belongs to dealership, not employee.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-153 — LISTING-CREATE-005

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: Specified OWNER/MANAGER/STAFF A; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/vehicles/new and /dealer/inventory. Record the initial visible state and fixture resource IDs.
2. Enter a fresh registration, Continue, enter the specified valid/invalid vehicle fields and Save draft. Reopen the same draft after the indicated navigation or membership change; compare ownership/creator via the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Draft records creating actor.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-154 — LISTING-CREATE-006

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: Specified OWNER/MANAGER/STAFF A; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/vehicles/new and /dealer/inventory. Record the initial visible state and fixture resource IDs.
2. Enter a fresh registration, Continue, enter the specified valid/invalid vehicle fields and Save draft. Reopen the same draft after the indicated navigation or membership change; compare ownership/creator via the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF edits permitted draft fields.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-155 — LISTING-CREATE-007

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: Specified OWNER/MANAGER/STAFF A; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/vehicles/new and /dealer/inventory. Record the initial visible state and fixture resource IDs.
2. Enter a fresh registration, Continue, enter the specified valid/invalid vehicle fields and Save draft. Reopen the same draft after the indicated navigation or membership change; compare ownership/creator via the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER edits permitted draft fields.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-156 — LISTING-CREATE-008

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: Specified OWNER/MANAGER/STAFF A; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/vehicles/new and /dealer/inventory. Record the initial visible state and fixture resource IDs.
2. Enter a fresh registration, Continue, enter the specified valid/invalid vehicle fields and Save draft. Reopen the same draft after the indicated navigation or membership change; compare ownership/creator via the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER edits permitted draft fields.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-157 — LISTING-CREATE-009

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: Specified OWNER/MANAGER/STAFF A; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/vehicles/new and /dealer/inventory. Record the initial visible state and fixture resource IDs.
2. Enter a fresh registration, Continue, enter the specified valid/invalid vehicle fields and Save draft. Reopen the same draft after the indicated navigation or membership change; compare ownership/creator via the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Required fields validated server-side.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-158 — LISTING-CREATE-010

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: Specified OWNER/MANAGER/STAFF A; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/vehicles/new and /dealer/inventory. Record the initial visible state and fixture resource IDs.
2. Enter a fresh registration, Continue, enter the specified valid/invalid vehicle fields and Save draft. Reopen the same draft after the indicated navigation or membership change; compare ownership/creator via the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Invalid price/year/km/vehicle data rejected.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-159 — LISTING-CREATE-011

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: Specified OWNER/MANAGER/STAFF A; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/vehicles/new and /dealer/inventory. Record the initial visible state and fixture resource IDs.
2. Enter a fresh registration, Continue, enter the specified valid/invalid vehicle fields and Save draft. Reopen the same draft after the indicated navigation or membership change; compare ownership/creator via the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Listing cannot be assigned to another dealership via manipulated request.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-160 — LISTING-CREATE-012

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: Specified OWNER/MANAGER/STAFF A; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/vehicles/new and /dealer/inventory. Record the initial visible state and fixture resource IDs.
2. Enter a fresh registration, Continue, enter the specified valid/invalid vehicle fields and Save draft. Reopen the same draft after the indicated navigation or membership change; compare ownership/creator via the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Duplicate submissions do not create unintended duplicate listings.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-161 — LISTING-CREATE-013

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: Specified OWNER/MANAGER/STAFF A; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/vehicles/new and /dealer/inventory. Record the initial visible state and fixture resource IDs.
2. Enter a fresh registration, Continue, enter the specified valid/invalid vehicle fields and Save draft. Reopen the same draft after the indicated navigation or membership change; compare ownership/creator via the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Concurrent edits remain predictable.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-162 — LISTING-CREATE-014

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: Specified OWNER/MANAGER/STAFF A; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/vehicles/new and /dealer/inventory. Record the initial visible state and fixture resource IDs.
2. Enter a fresh registration, Continue, enter the specified valid/invalid vehicle fields and Save draft. Reopen the same draft after the indicated navigation or membership change; compare ownership/creator via the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Refresh/navigation does not lose persisted draft unexpectedly.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-163 — LISTING-CREATE-015

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: Specified OWNER/MANAGER/STAFF A; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/vehicles/new and /dealer/inventory. Record the initial visible state and fixture resource IDs.
2. Enter a fresh registration, Continue, enter the specified valid/invalid vehicle fields and Save draft. Reopen the same draft after the indicated navigation or membership change; compare ownership/creator via the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin/team media remains linked to correct vehicle.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-164 — LISTING-CREATE-016

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: Specified OWNER/MANAGER/STAFF A; Dealer B; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/vehicles/new and /dealer/inventory. Record the initial visible state and fixture resource IDs.
2. Enter a fresh registration, Continue, enter the specified valid/invalid vehicle fields and Save draft. Reopen the same draft after the indicated navigation or membership change; compare ownership/creator via the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer cannot access another dealership's draft.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-165 — MODERATION-001

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: OWNER/MANAGER/STAFF A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /admin/listings. Record the initial visible state and fixture resource IDs.
2. Use the specified incomplete/complete draft. Submit as the stated role; Admin opens the review, checklist/media and approve/reject/request-changes action. Refresh public /cars and the dealer inventory.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF cannot submit for moderation.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-166 — MODERATION-002

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: OWNER/MANAGER/STAFF A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /admin/listings. Record the initial visible state and fixture resource IDs.
2. Use the specified incomplete/complete draft. Submit as the stated role; Admin opens the review, checklist/media and approve/reject/request-changes action. Refresh public /cars and the dealer inventory.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF direct API submission denied.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-167 — MODERATION-003

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: OWNER/MANAGER/STAFF A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /admin/listings. Record the initial visible state and fixture resource IDs.
2. Use the specified incomplete/complete draft. Submit as the stated role; Admin opens the review, checklist/media and approve/reject/request-changes action. Refresh public /cars and the dealer inventory.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER submits valid draft.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-168 — MODERATION-004

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: OWNER/MANAGER/STAFF A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /admin/listings. Record the initial visible state and fixture resource IDs.
2. Use the specified incomplete/complete draft. Submit as the stated role; Admin opens the review, checklist/media and approve/reject/request-changes action. Refresh public /cars and the dealer inventory.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER submits valid draft.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-169 — MODERATION-005

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: OWNER/MANAGER/STAFF A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /admin/listings. Record the initial visible state and fixture resource IDs.
2. Use the specified incomplete/complete draft. Submit as the stated role; Admin opens the review, checklist/media and approve/reject/request-changes action. Refresh public /cars and the dealer inventory.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Incomplete listing cannot submit.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-170 — MODERATION-006

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: OWNER/MANAGER/STAFF A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /admin/listings. Record the initial visible state and fixture resource IDs.
2. Use the specified incomplete/complete draft. Submit as the stated role; Admin opens the review, checklist/media and approve/reject/request-changes action. Refresh public /cars and the dealer inventory.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Submitted listing enters correct moderation state.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-171 — MODERATION-007

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: OWNER/MANAGER/STAFF A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /admin/listings. Record the initial visible state and fixture resource IDs.
2. Use the specified incomplete/complete draft. Submit as the stated role; Admin opens the review, checklist/media and approve/reject/request-changes action. Refresh public /cars and the dealer inventory.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Submitted listing remains non-public before approval.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-172 — MODERATION-008

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: OWNER/MANAGER/STAFF A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /admin/listings. Record the initial visible state and fixture resource IDs.
2. Use the specified incomplete/complete draft. Submit as the stated role; Admin opens the review, checklist/media and approve/reject/request-changes action. Refresh public /cars and the dealer inventory.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin sees listing in moderation queue.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-173 — MODERATION-009

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: OWNER/MANAGER/STAFF A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /admin/listings. Record the initial visible state and fixture resource IDs.
2. Use the specified incomplete/complete draft. Submit as the stated role; Admin opens the review, checklist/media and approve/reject/request-changes action. Refresh public /cars and the dealer inventory.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin sees correct dealer/listing/media information.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-174 — MODERATION-010

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: OWNER/MANAGER/STAFF A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /admin/listings. Record the initial visible state and fixture resource IDs.
2. Use the specified incomplete/complete draft. Submit as the stated role; Admin opens the review, checklist/media and approve/reject/request-changes action. Refresh public /cars and the dealer inventory.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin approves valid listing.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-175 — MODERATION-011

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: OWNER/MANAGER/STAFF A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /admin/listings. Record the initial visible state and fixture resource IDs.
2. Use the specified incomplete/complete draft. Submit as the stated role; Admin opens the review, checklist/media and approve/reject/request-changes action. Refresh public /cars and the dealer inventory.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Approved listing becomes publicly discoverable correctly.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-176 — MODERATION-012

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: OWNER/MANAGER/STAFF A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /admin/listings. Record the initial visible state and fixture resource IDs.
2. Use the specified incomplete/complete draft. Submit as the stated role; Admin opens the review, checklist/media and approve/reject/request-changes action. Refresh public /cars and the dealer inventory.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin rejects listing.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-177 — MODERATION-013

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: OWNER/MANAGER/STAFF A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /admin/listings. Record the initial visible state and fixture resource IDs.
2. Use the specified incomplete/complete draft. Submit as the stated role; Admin opens the review, checklist/media and approve/reject/request-changes action. Refresh public /cars and the dealer inventory.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Rejected listing remains non-public.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-178 — MODERATION-014

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: OWNER/MANAGER/STAFF A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /admin/listings. Record the initial visible state and fixture resource IDs.
2. Use the specified incomplete/complete draft. Submit as the stated role; Admin opens the review, checklist/media and approve/reject/request-changes action. Refresh public /cars and the dealer inventory.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer sees rejection state/reason where supported.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-179 — MODERATION-015

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: OWNER/MANAGER/STAFF A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /admin/listings. Record the initial visible state and fixture resource IDs.
2. Use the specified incomplete/complete draft. Submit as the stated role; Admin opens the review, checklist/media and approve/reject/request-changes action. Refresh public /cars and the dealer inventory.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer corrects and resubmits rejected listing.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-180 — MODERATION-016

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: OWNER/MANAGER/STAFF A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /admin/listings. Record the initial visible state and fixture resource IDs.
2. Use the specified incomplete/complete draft. Submit as the stated role; Admin opens the review, checklist/media and approve/reject/request-changes action. Refresh public /cars and the dealer inventory.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Duplicate moderation action does not create invalid state.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-181 — MODERATION-017

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: OWNER/MANAGER/STAFF A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /admin/listings. Record the initial visible state and fixture resource IDs.
2. Use the specified incomplete/complete draft. Submit as the stated role; Admin opens the review, checklist/media and approve/reject/request-changes action. Refresh public /cars and the dealer inventory.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Concurrent Admin approve/reject cannot corrupt lifecycle.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-182 — MODERATION-018

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J005.

Setup: OWNER/MANAGER/STAFF A; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /admin/listings. Record the initial visible state and fixture resource IDs.
2. Use the specified incomplete/complete draft. Submit as the stated role; Admin opens the review, checklist/media and approve/reject/request-changes action. Refresh public /cars and the dealer inventory.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Moderation actions audit logged.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-196 — LISTING-LIFE-001

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Approved listing enters ACTIVE correctly.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-197 — LISTING-LIFE-002

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: ACTIVE appears `/cars`.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-198 — LISTING-LIFE-003

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: ACTIVE appears dealer portfolio.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-199 — LISTING-LIFE-004

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: ACTIVE contributes correct public dealer count.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-200 — LISTING-LIFE-005

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER can transition eligible listing to RESERVED.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-201 — LISTING-LIFE-006

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER can transition eligible listing to RESERVED.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-202 — LISTING-LIFE-007

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF cannot RESERVED.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-203 — LISTING-LIFE-008

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: RESERVED visual state correct.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-204 — LISTING-LIFE-009

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: RESERVED interaction/navigation follows defined behavior.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-205 — LISTING-LIFE-010

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: RESERVED enquiry behavior correct.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-206 — LISTING-LIFE-011

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: RESERVED → ACTIVE works if supported.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-207 — LISTING-LIFE-012

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER can mark eligible vehicle SOLD.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-208 — LISTING-LIFE-013

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER can mark eligible vehicle SOLD.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-209 — LISTING-LIFE-014

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF cannot SOLD.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-210 — LISTING-LIFE-015

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: SOLD disappears public inventory.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-211 — LISTING-LIFE-016

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: SOLD disappears dealer public available inventory.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-212 — LISTING-LIFE-017

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: SOLD removed from active listing count.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-213 — LISTING-LIFE-018

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: SOLD remains in dealer/Admin history.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-214 — LISTING-LIFE-019

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Existing enquiries survive SOLD.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-215 — LISTING-LIFE-020

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Customer enquiry history survives SOLD.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-216 — LISTING-LIFE-021

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER can WITHDRAW.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-217 — LISTING-LIFE-022

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER can WITHDRAW.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-218 — LISTING-LIFE-023

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF cannot WITHDRAW.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-219 — LISTING-LIFE-024

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: WITHDRAWN disappears publicly.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-220 — LISTING-LIFE-025

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: WITHDRAWN remains internal history.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-221 — LISTING-LIFE-026

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Existing enquiries survive WITHDRAWN.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-222 — LISTING-LIFE-027

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Invalid transitions rejected.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-223 — LISTING-LIFE-028

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Direct API cannot bypass lifecycle.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-224 — LISTING-LIFE-029

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Concurrent lifecycle mutations cannot produce impossible state.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-225 — LISTING-LIFE-030

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Public search/read model stays synchronized.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-226 — LISTING-LIFE-031

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: OWNER/MANAGER/STAFF A; Customer; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/inventory and /cars. Record the initial visible state and fixture resource IDs.
2. Reset ACTIVE fixture; choose the indicated Reserve, Mark sold, Withdraw or supported reactivation review. Refresh car/dealer/search/count/customer-history views. Use collection requests for forbidden transitions.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Lifecycle changes correctly update counts/search without stale exposure.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-227 — MEMBER-001

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J007.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Existing owner becomes OWNER after migration.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-228 — MEMBER-002

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J007.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER invites existing customer as MANAGER.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-229 — MEMBER-003

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J007.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER invites existing customer as STAFF.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-230 — MEMBER-004

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J007.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER invites unregistered phone.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-231 — MEMBER-005

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J007.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Existing customer invitation creates no duplicate user.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-232 — MEMBER-006

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J007.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: New member performs only required identity verification, not dealer verification.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-233 — MEMBER-007

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J007.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Accepted invitation joins correct dealership.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-234 — MEMBER-008

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J007.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Duplicate membership prevented.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-235 — MEMBER-009

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J007.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Duplicate active invitation handled.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-236 — MEMBER-010

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J007.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Expired invitation rejected.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-237 — MEMBER-011

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J007.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Revoked invitation rejected.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-238 — MEMBER-012

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J007.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Different authenticated person cannot accept invite.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-239 — MEMBER-013

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J007.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Invitation replay prevented.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-240 — MEMBER-014

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J007.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER changes MANAGER → STAFF.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-241 — MEMBER-015

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J007.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER changes STAFF → MANAGER.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-242 — MEMBER-016

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J007.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Permission changes apply without waiting for old dealer session expiration.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-243 — MEMBER-017

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J008.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER revokes/removes member.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-244 — MEMBER-018

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J008.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Removed member immediately loses dealership access.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-245 — MEMBER-019

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J008.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Existing session cannot retain dealership access.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-246 — MEMBER-020

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J008.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Removed member remains valid customer.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-247 — MEMBER-021

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J008.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Removed member can browse normally.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-248 — MEMBER-022

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J008.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Removed member retains personal saved cars.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-249 — MEMBER-023

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J008.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Removed member retains personal enquiries.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-250 — MEMBER-024

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J008.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Removed member cannot enter former dealer dashboard.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-251 — MEMBER-025

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J008.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Historical actions remain attributed to removed member.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-252 — MEMBER-026

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J008.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Removing member does not delete listings they created.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-253 — MEMBER-027

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J008.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Removing member does not delete enquiries they handled.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-254 — MEMBER-028

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J008.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Removing member does not mutate dealership-owned data.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-255 — MEMBER-029

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J007.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER cannot invite.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-256 — MEMBER-030

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J007.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER cannot change roles.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-257 — MEMBER-031

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J007.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER cannot remove members.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-258 — MEMBER-032

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J007.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF cannot manage members.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-259 — MEMBER-033

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J007.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Last OWNER cannot remove themselves.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-260 — MEMBER-034

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J007.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Last OWNER cannot demote themselves.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-261 — MEMBER-035

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J007.

Setup: OWNER A; invited customer; member; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/team. Record the initial visible state and fixture resource IDs.
2. Invite the fictional phone with the specified role, or change/remove that fixture member. Invitee accepts using the same normal customer identity. Retain the member profile for immediate stale-session checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Direct API cannot bypass membership restrictions.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-262 — IDENTITY-001

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J011.

Setup: Specified person; nonmember/dual-member fixture; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login → account menu → Dealer dashboard. Record the initial visible state and fixture resource IDs.
2. Login by normal customer OTP, switch to the offered dealer workspace, then return to Saved cars/My enquiries. Try the indicated unauthorized membership choice through the supplied collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER uses normal customer login and enters dealer dashboard without second login.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-263 — IDENTITY-002

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J011.

Setup: Specified person; nonmember/dual-member fixture; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login → account menu → Dealer dashboard. Record the initial visible state and fixture resource IDs.
2. Login by normal customer OTP, switch to the offered dealer workspace, then return to Saved cars/My enquiries. Try the indicated unauthorized membership choice through the supplied collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER does same.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-264 — IDENTITY-003

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J011.

Setup: Specified person; nonmember/dual-member fixture; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login → account menu → Dealer dashboard. Record the initial visible state and fixture resource IDs.
2. Login by normal customer OTP, switch to the offered dealer workspace, then return to Saved cars/My enquiries. Try the indicated unauthorized membership choice through the supplied collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF does same.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-265 — IDENTITY-004

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J011.

Setup: Specified person; nonmember/dual-member fixture; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login → account menu → Dealer dashboard. Record the initial visible state and fixture resource IDs.
2. Login by normal customer OTP, switch to the offered dealer workspace, then return to Saved cars/My enquiries. Try the indicated unauthorized membership choice through the supplied collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Customer without membership denied dealer dashboard.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-266 — IDENTITY-005

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J011.

Setup: Specified person; nonmember/dual-member fixture; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login → account menu → Dealer dashboard. Record the initial visible state and fixture resource IDs.
2. Login by normal customer OTP, switch to the offered dealer workspace, then return to Saved cars/My enquiries. Try the indicated unauthorized membership choice through the supplied collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Personal → Dealer requires no OTP.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-267 — IDENTITY-006

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J011.

Setup: Specified person; nonmember/dual-member fixture; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login → account menu → Dealer dashboard. Record the initial visible state and fixture resource IDs.
2. Login by normal customer OTP, switch to the offered dealer workspace, then return to Saved cars/My enquiries. Try the indicated unauthorized membership choice through the supplied collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer → Personal requires no OTP.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-268 — IDENTITY-007

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J011.

Setup: Specified person; nonmember/dual-member fixture; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login → account menu → Dealer dashboard. Record the initial visible state and fixture resource IDs.
2. Login by normal customer OTP, switch to the offered dealer workspace, then return to Saved cars/My enquiries. Try the indicated unauthorized membership choice through the supplied collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Switching does not create duplicate session/user.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-269 — IDENTITY-008

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J011.

Setup: Specified person; nonmember/dual-member fixture; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login → account menu → Dealer dashboard. Record the initial visible state and fixture resource IDs.
2. Login by normal customer OTP, switch to the offered dealer workspace, then return to Saved cars/My enquiries. Try the indicated unauthorized membership choice through the supplied collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Personal customer actions remain human-owned rather than dealership-owned.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-270 — IDENTITY-009

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J011.

Setup: Specified person; nonmember/dual-member fixture; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login → account menu → Dealer dashboard. Record the initial visible state and fixture resource IDs.
2. Login by normal customer OTP, switch to the offered dealer workspace, then return to Saved cars/My enquiries. Try the indicated unauthorized membership choice through the supplied collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer actions associate dealership plus actor.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-271 — IDENTITY-010

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J008.

Setup: Specified person; nonmember/dual-member fixture; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login → account menu → Dealer dashboard. Record the initial visible state and fixture resource IDs.
2. Login by normal customer OTP, switch to the offered dealer workspace, then return to Saved cars/My enquiries. Try the indicated unauthorized membership choice through the supplied collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Revocation while dealer context open denies subsequent dealer requests.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-272 — IDENTITY-011

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J008.

Setup: Specified person; nonmember/dual-member fixture; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login → account menu → Dealer dashboard. Record the initial visible state and fixture resource IDs.
2. Login by normal customer OTP, switch to the offered dealer workspace, then return to Saved cars/My enquiries. Try the indicated unauthorized membership choice through the supplied collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Revocation does not terminate customer access.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-273 — IDENTITY-012

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J011.

Setup: Specified person; nonmember/dual-member fixture; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login → account menu → Dealer dashboard. Record the initial visible state and fixture resource IDs.
2. Login by normal customer OTP, switch to the offered dealer workspace, then return to Saved cars/My enquiries. Try the indicated unauthorized membership choice through the supplied collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer suspension blocks dealer operations but preserves personal customer access.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-274 — IDENTITY-013

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J011.

Setup: Specified person; nonmember/dual-member fixture; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login → account menu → Dealer dashboard. Record the initial visible state and fixture resource IDs.
2. Login by normal customer OTP, switch to the offered dealer workspace, then return to Saved cars/My enquiries. Try the indicated unauthorized membership choice through the supplied collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Multiple dealership membership resolves correct dealer context.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-275 — IDENTITY-014

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J011.

Setup: Specified person; nonmember/dual-member fixture; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /login → account menu → Dealer dashboard. Record the initial visible state and fixture resource IDs.
2. Login by normal customer OTP, switch to the offered dealer workspace, then return to Saved cars/My enquiries. Try the indicated unauthorized membership choice through the supplied collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: User cannot manipulate workspace/dealer IDs to access unauthorized dealership.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-276 — OWNER-001

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: OWNER A; Dealer B; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory, Enquiries, Dealer profile or Team for the specified capability. Confirm all promised actions, then repeat foreign-tenant/Admin API requests from the collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER accesses intended dashboard.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-277 — OWNER-002

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: OWNER A; Dealer B; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory, Enquiries, Dealer profile or Team for the specified capability. Confirm all promised actions, then repeat foreign-tenant/Admin API requests from the collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER manages listings.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-278 — OWNER-003

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: OWNER A; Dealer B; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory, Enquiries, Dealer profile or Team for the specified capability. Confirm all promised actions, then repeat foreign-tenant/Admin API requests from the collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER manages enquiries.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-279 — OWNER-004

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: OWNER A; Dealer B; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory, Enquiries, Dealer profile or Team for the specified capability. Confirm all promised actions, then repeat foreign-tenant/Admin API requests from the collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER edits dealership profile.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-280 — OWNER-005

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: OWNER A; Dealer B; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory, Enquiries, Dealer profile or Team for the specified capability. Confirm all promised actions, then repeat foreign-tenant/Admin API requests from the collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER manages permitted verification actions.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-281 — OWNER-006

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: OWNER A; Dealer B; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory, Enquiries, Dealer profile or Team for the specified capability. Confirm all promised actions, then repeat foreign-tenant/Admin API requests from the collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER manages Team.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-282 — OWNER-007

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: OWNER A; Dealer B; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory, Enquiries, Dealer profile or Team for the specified capability. Confirm all promised actions, then repeat foreign-tenant/Admin API requests from the collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER cannot access another dealer's resources.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-283 — OWNER-008

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: OWNER A; Dealer B; Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory, Enquiries, Dealer profile or Team for the specified capability. Confirm all promised actions, then repeat foreign-tenant/Admin API requests from the collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER cannot perform Admin-only operations.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-284 — MANAGER-001

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: MANAGER A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries for the specified allowed operation. Try Team/profile/KYC/Admin controls and equivalent requests with the same manager identity for forbidden capabilities.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER accesses dealer dashboard.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-285 — MANAGER-002

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: MANAGER A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries for the specified allowed operation. Try Team/profile/KYC/Admin controls and equivalent requests with the same manager identity for forbidden capabilities.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER views inventory.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-286 — MANAGER-003

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: MANAGER A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries for the specified allowed operation. Try Team/profile/KYC/Admin controls and equivalent requests with the same manager identity for forbidden capabilities.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER creates/edits drafts.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-287 — MANAGER-004

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: MANAGER A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries for the specified allowed operation. Try Team/profile/KYC/Admin controls and equivalent requests with the same manager identity for forbidden capabilities.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER submits eligible listing.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-288 — MANAGER-005

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: MANAGER A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries for the specified allowed operation. Try Team/profile/KYC/Admin controls and equivalent requests with the same manager identity for forbidden capabilities.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER performs allowed listing lifecycle transitions.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-289 — MANAGER-006

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: MANAGER A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries for the specified allowed operation. Try Team/profile/KYC/Admin controls and equivalent requests with the same manager identity for forbidden capabilities.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER views enquiries.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-290 — MANAGER-007

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: MANAGER A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries for the specified allowed operation. Try Team/profile/KYC/Admin controls and equivalent requests with the same manager identity for forbidden capabilities.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER marks CONTACTED.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-291 — MANAGER-008

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: MANAGER A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries for the specified allowed operation. Try Team/profile/KYC/Admin controls and equivalent requests with the same manager identity for forbidden capabilities.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER closes enquiry.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-292 — MANAGER-009

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: MANAGER A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries for the specified allowed operation. Try Team/profile/KYC/Admin controls and equivalent requests with the same manager identity for forbidden capabilities.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER cannot edit protected dealer profile.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-293 — MANAGER-010

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: MANAGER A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries for the specified allowed operation. Try Team/profile/KYC/Admin controls and equivalent requests with the same manager identity for forbidden capabilities.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER cannot manage verification.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-294 — MANAGER-011

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: MANAGER A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries for the specified allowed operation. Try Team/profile/KYC/Admin controls and equivalent requests with the same manager identity for forbidden capabilities.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER cannot manage Team.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-295 — MANAGER-012

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: MANAGER A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries for the specified allowed operation. Try Team/profile/KYC/Admin controls and equivalent requests with the same manager identity for forbidden capabilities.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER cannot access Admin.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-296 — MANAGER-013

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: MANAGER A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries for the specified allowed operation. Try Team/profile/KYC/Admin controls and equivalent requests with the same manager identity for forbidden capabilities.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER cannot access another dealer's resources.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-297 — STAFF-001

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: STAFF A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries to prepare draft or mark New contacted. Try Submit/Reserve/Mark sold/Withdraw/Close/Team/profile/KYC/Admin requests for the exact forbidden capability; expect denial and unchanged state.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF accesses permitted dashboard.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-298 — STAFF-002

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: STAFF A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries to prepare draft or mark New contacted. Try Submit/Reserve/Mark sold/Withdraw/Close/Team/profile/KYC/Admin requests for the exact forbidden capability; expect denial and unchanged state.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF views inventory.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-299 — STAFF-003

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: STAFF A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries to prepare draft or mark New contacted. Try Submit/Reserve/Mark sold/Withdraw/Close/Team/profile/KYC/Admin requests for the exact forbidden capability; expect denial and unchanged state.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF creates draft.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-300 — STAFF-004

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: STAFF A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries to prepare draft or mark New contacted. Try Submit/Reserve/Mark sold/Withdraw/Close/Team/profile/KYC/Admin requests for the exact forbidden capability; expect denial and unchanged state.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF edits permitted draft.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-301 — STAFF-005

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: STAFF A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries to prepare draft or mark New contacted. Try Submit/Reserve/Mark sold/Withdraw/Close/Team/profile/KYC/Admin requests for the exact forbidden capability; expect denial and unchanged state.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF cannot submit.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-302 — STAFF-006

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: STAFF A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries to prepare draft or mark New contacted. Try Submit/Reserve/Mark sold/Withdraw/Close/Team/profile/KYC/Admin requests for the exact forbidden capability; expect denial and unchanged state.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF cannot RESERVED.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-303 — STAFF-007

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: STAFF A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries to prepare draft or mark New contacted. Try Submit/Reserve/Mark sold/Withdraw/Close/Team/profile/KYC/Admin requests for the exact forbidden capability; expect denial and unchanged state.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF cannot SOLD.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-304 — STAFF-008

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: STAFF A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries to prepare draft or mark New contacted. Try Submit/Reserve/Mark sold/Withdraw/Close/Team/profile/KYC/Admin requests for the exact forbidden capability; expect denial and unchanged state.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF cannot WITHDRAW.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-305 — STAFF-009

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: STAFF A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries to prepare draft or mark New contacted. Try Submit/Reserve/Mark sold/Withdraw/Close/Team/profile/KYC/Admin requests for the exact forbidden capability; expect denial and unchanged state.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF views enquiries.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-306 — STAFF-010

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: STAFF A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries to prepare draft or mark New contacted. Try Submit/Reserve/Mark sold/Withdraw/Close/Team/profile/KYC/Admin requests for the exact forbidden capability; expect denial and unchanged state.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF views required enquiry contact details.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-307 — STAFF-011

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: STAFF A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries to prepare draft or mark New contacted. Try Submit/Reserve/Mark sold/Withdraw/Close/Team/profile/KYC/Admin requests for the exact forbidden capability; expect denial and unchanged state.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF marks NEW → CONTACTED.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-308 — STAFF-012

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: STAFF A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries to prepare draft or mark New contacted. Try Submit/Reserve/Mark sold/Withdraw/Close/Team/profile/KYC/Admin requests for the exact forbidden capability; expect denial and unchanged state.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF cannot close.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-309 — STAFF-013

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: STAFF A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries to prepare draft or mark New contacted. Try Submit/Reserve/Mark sold/Withdraw/Close/Team/profile/KYC/Admin requests for the exact forbidden capability; expect denial and unchanged state.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF cannot edit protected dealer profile.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-310 — STAFF-014

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: STAFF A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries to prepare draft or mark New contacted. Try Submit/Reserve/Mark sold/Withdraw/Close/Team/profile/KYC/Admin requests for the exact forbidden capability; expect denial and unchanged state.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF cannot manage verification.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-311 — STAFF-015

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: STAFF A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries to prepare draft or mark New contacted. Try Submit/Reserve/Mark sold/Withdraw/Close/Team/profile/KYC/Admin requests for the exact forbidden capability; expect denial and unchanged state.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF cannot manage Team.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-312 — STAFF-016

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: STAFF A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries to prepare draft or mark New contacted. Try Submit/Reserve/Mark sold/Withdraw/Close/Team/profile/KYC/Admin requests for the exact forbidden capability; expect denial and unchanged state.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF cannot access Admin.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-313 — STAFF-017

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: STAFF A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer. Record the initial visible state and fixture resource IDs.
2. Use Inventory/Add vehicle/Enquiries to prepare draft or mark New contacted. Try Submit/Reserve/Mark sold/Withdraw/Close/Team/profile/KYC/Admin requests for the exact forbidden capability; expect denial and unchanged state.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF cannot access another dealer's resources.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-314 — PROFILE-001

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: OWNER A; MANAGER/STAFF negative profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/profile. Record the initial visible state and fixture resource IDs.
2. Edit the specified field with valid/invalid fixture values, submit/save and inspect any review/verification requirement. Refresh public dealer profile. Repeat the same write under MANAGER/STAFF identities in the collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER updates permitted profile information.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-315 — PROFILE-002

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: OWNER A; MANAGER/STAFF negative profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/profile. Record the initial visible state and fixture resource IDs.
2. Edit the specified field with valid/invalid fixture values, submit/save and inspect any review/verification requirement. Refresh public dealer profile. Repeat the same write under MANAGER/STAFF identities in the collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER cannot update owner-only profile fields.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-316 — PROFILE-003

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: OWNER A; MANAGER/STAFF negative profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/profile. Record the initial visible state and fixture resource IDs.
2. Edit the specified field with valid/invalid fixture values, submit/save and inspect any review/verification requirement. Refresh public dealer profile. Repeat the same write under MANAGER/STAFF identities in the collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF cannot update dealer profile.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-317 — PROFILE-004

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: OWNER A; MANAGER/STAFF negative profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/profile. Record the initial visible state and fixture resource IDs.
2. Edit the specified field with valid/invalid fixture values, submit/save and inspect any review/verification requirement. Refresh public dealer profile. Repeat the same write under MANAGER/STAFF identities in the collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Public dealer profile reflects approved changes.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-318 — PROFILE-005

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: OWNER A; MANAGER/STAFF negative profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/profile. Record the initial visible state and fixture resource IDs.
2. Edit the specified field with valid/invalid fixture values, submit/save and inspect any review/verification requirement. Refresh public dealer profile. Repeat the same write under MANAGER/STAFF identities in the collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Verification-sensitive fields cannot bypass re-verification policy.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-319 — PROFILE-006

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: OWNER A; MANAGER/STAFF negative profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/profile. Record the initial visible state and fixture resource IDs.
2. Edit the specified field with valid/invalid fixture values, submit/save and inspect any review/verification requirement. Refresh public dealer profile. Repeat the same write under MANAGER/STAFF identities in the collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Invalid profile values rejected.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-320 — PROFILE-007

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: OWNER A; MANAGER/STAFF negative profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/profile. Record the initial visible state and fixture resource IDs.
2. Edit the specified field with valid/invalid fixture values, submit/save and inspect any review/verification requirement. Refresh public dealer profile. Repeat the same write under MANAGER/STAFF identities in the collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer media cannot expose another dealership's assets.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-321 — PROFILE-008

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: OWNER A; MANAGER/STAFF negative profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /dealer/profile. Record the initial visible state and fixture resource IDs.
2. Edit the specified field with valid/invalid fixture values, submit/save and inspect any review/verification requirement. Refresh public dealer profile. Repeat the same write under MANAGER/STAFF identities in the collection.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Profile update audit logged.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-322 — ADMIN-AUTH-001

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin/non-admin Google and person profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Admin sign-in entry. Record the initial visible state and fixture resource IDs.
2. Authenticate with the approved Google test account, then repeat as the stated unauthorized identity. For expiry/logout/bootstrap have QA prepare the exact fixture and request the same protected Admin page/API.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Valid Admin authenticates.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-323 — ADMIN-AUTH-002

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin/non-admin Google and person profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Admin sign-in entry. Record the initial visible state and fixture resource IDs.
2. Authenticate with the approved Google test account, then repeat as the stated unauthorized identity. For expiry/logout/bootstrap have QA prepare the exact fixture and request the same protected Admin page/API.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Non-admin cannot access Admin UI.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-324 — ADMIN-AUTH-003

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin/non-admin Google and person profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Admin sign-in entry. Record the initial visible state and fixture resource IDs.
2. Authenticate with the approved Google test account, then repeat as the stated unauthorized identity. For expiry/logout/bootstrap have QA prepare the exact fixture and request the same protected Admin page/API.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER cannot access Admin APIs.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-325 — ADMIN-AUTH-004

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin/non-admin Google and person profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Admin sign-in entry. Record the initial visible state and fixture resource IDs.
2. Authenticate with the approved Google test account, then repeat as the stated unauthorized identity. For expiry/logout/bootstrap have QA prepare the exact fixture and request the same protected Admin page/API.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER cannot access Admin APIs.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-326 — ADMIN-AUTH-005

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin/non-admin Google and person profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Admin sign-in entry. Record the initial visible state and fixture resource IDs.
2. Authenticate with the approved Google test account, then repeat as the stated unauthorized identity. For expiry/logout/bootstrap have QA prepare the exact fixture and request the same protected Admin page/API.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF cannot access Admin APIs.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-327 — ADMIN-AUTH-006

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin/non-admin Google and person profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Admin sign-in entry. Record the initial visible state and fixture resource IDs.
2. Authenticate with the approved Google test account, then repeat as the stated unauthorized identity. For expiry/logout/bootstrap have QA prepare the exact fixture and request the same protected Admin page/API.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Customer cannot access Admin APIs.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-328 — ADMIN-AUTH-007

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin/non-admin Google and person profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Admin sign-in entry. Record the initial visible state and fixture resource IDs.
2. Authenticate with the approved Google test account, then repeat as the stated unauthorized identity. For expiry/logout/bootstrap have QA prepare the exact fixture and request the same protected Admin page/API.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Hidden Admin navigation backed by server authorization.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-329 — ADMIN-AUTH-008

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin/non-admin Google and person profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Admin sign-in entry. Record the initial visible state and fixture resource IDs.
2. Authenticate with the approved Google test account, then repeat as the stated unauthorized identity. For expiry/logout/bootstrap have QA prepare the exact fixture and request the same protected Admin page/API.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin session expiry safe.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-330 — ADMIN-AUTH-009

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin/non-admin Google and person profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Admin sign-in entry. Record the initial visible state and fixture resource IDs.
2. Authenticate with the approved Google test account, then repeat as the stated unauthorized identity. For expiry/logout/bootstrap have QA prepare the exact fixture and request the same protected Admin page/API.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin logout invalidates Admin access.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-331 — ADMIN-AUTH-010

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin/non-admin Google and person profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Admin sign-in entry. Record the initial visible state and fixture resource IDs.
2. Authenticate with the approved Google test account, then repeat as the stated unauthorized identity. For expiry/logout/bootstrap have QA prepare the exact fixture and request the same protected Admin page/API.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin bootstrap cannot create unauthorized Admins.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-332 — ADMIN-DEALER-001

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; Dealer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers. Record the initial visible state and fixture resource IDs.
2. Search/open the disposable application/dealer and execute the exact indicated review/state action. Refresh member/public/customer profiles; request the corresponding audit entry from QA.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Authorized Admin user-management behavior works.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-333 — ADMIN-DEALER-002

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J004.

Setup: Admin; Dealer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers. Record the initial visible state and fixture resource IDs.
2. Search/open the disposable application/dealer and execute the exact indicated review/state action. Refresh member/public/customer profiles; request the corresponding audit entry from QA.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin sees onboarding applications.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-334 — ADMIN-DEALER-003

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J004.

Setup: Admin; Dealer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers. Record the initial visible state and fixture resource IDs.
2. Search/open the disposable application/dealer and execute the exact indicated review/state action. Refresh member/public/customer profiles; request the corresponding audit entry from QA.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin inspects verification data.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-335 — ADMIN-DEALER-004

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J004.

Setup: Admin; Dealer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers. Record the initial visible state and fixture resource IDs.
2. Search/open the disposable application/dealer and execute the exact indicated review/state action. Refresh member/public/customer profiles; request the corresponding audit entry from QA.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin approves eligible dealer.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-336 — ADMIN-DEALER-005

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J004.

Setup: Admin; Dealer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers. Record the initial visible state and fixture resource IDs.
2. Search/open the disposable application/dealer and execute the exact indicated review/state action. Refresh member/public/customer profiles; request the corresponding audit entry from QA.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin rejects dealer.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-337 — ADMIN-DEALER-006

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Admin; Dealer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers. Record the initial visible state and fixture resource IDs.
2. Search/open the disposable application/dealer and execute the exact indicated review/state action. Refresh member/public/customer profiles; request the corresponding audit entry from QA.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin suspends active dealer.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-338 — ADMIN-DEALER-007

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Admin; Dealer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers. Record the initial visible state and fixture resource IDs.
2. Search/open the disposable application/dealer and execute the exact indicated review/state action. Refresh member/public/customer profiles; request the corresponding audit entry from QA.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin reinstates eligible suspended dealer.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-339 — ADMIN-DEALER-008

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Admin; Dealer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers. Record the initial visible state and fixture resource IDs.
2. Search/open the disposable application/dealer and execute the exact indicated review/state action. Refresh member/public/customer profiles; request the corresponding audit entry from QA.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer state changes immediately affect authorization/public visibility according to policy.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-340 — ADMIN-DEALER-009

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; Dealer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers. Record the initial visible state and fixture resource IDs.
2. Search/open the disposable application/dealer and execute the exact indicated review/state action. Refresh member/public/customer profiles; request the corresponding audit entry from QA.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin dealer actions audit logged.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-341 — ADMIN-DEALER-010

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; Dealer A; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/dealers. Record the initial visible state and fixture resource IDs.
2. Search/open the disposable application/dealer and execute the exact indicated review/state action. Refresh member/public/customer profiles; request the corresponding audit entry from QA.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Repeated Admin requests cannot create impossible dealer state.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-342 — ADMIN-LISTING-001

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; Dealer A role; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/listings. Record the initial visible state and fixture resource IDs.
2. Open the indicated pending/complete/ineligible listing and perform approve/reject/review while a separate member/Admin profile makes the specified state change. Refresh public visibility and request audit evidence.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin sees moderation queue.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-343 — ADMIN-LISTING-002

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; Dealer A role; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/listings. Record the initial visible state and fixture resource IDs.
2. Open the indicated pending/complete/ineligible listing and perform approve/reject/review while a separate member/Admin profile makes the specified state change. Refresh public visibility and request audit evidence.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin sees correct dealer/listing/media.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-344 — ADMIN-LISTING-003

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; Dealer A role; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/listings. Record the initial visible state and fixture resource IDs.
2. Open the indicated pending/complete/ineligible listing and perform approve/reject/review while a separate member/Admin profile makes the specified state change. Refresh public visibility and request audit evidence.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin approves eligible listing.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-345 — ADMIN-LISTING-004

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; Dealer A role; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/listings. Record the initial visible state and fixture resource IDs.
2. Open the indicated pending/complete/ineligible listing and perform approve/reject/review while a separate member/Admin profile makes the specified state change. Refresh public visibility and request audit evidence.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin rejects eligible listing.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-346 — ADMIN-LISTING-005

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; Dealer A role; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/listings. Record the initial visible state and fixture resource IDs.
2. Open the indicated pending/complete/ineligible listing and perform approve/reject/review while a separate member/Admin profile makes the specified state change. Refresh public visibility and request audit evidence.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Approval reaches public read model.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-347 — ADMIN-LISTING-006

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; Dealer A role; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/listings. Record the initial visible state and fixture resource IDs.
2. Open the indicated pending/complete/ineligible listing and perform approve/reject/review while a separate member/Admin profile makes the specified state change. Refresh public visibility and request audit evidence.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Rejected listing remains non-public.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-348 — ADMIN-LISTING-007

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; Dealer A role; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/listings. Record the initial visible state and fixture resource IDs.
2. Open the indicated pending/complete/ineligible listing and perform approve/reject/review while a separate member/Admin profile makes the specified state change. Refresh public visibility and request audit evidence.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Ineligible/suspended dealer listing cannot be improperly approved.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-349 — ADMIN-LISTING-008

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; Dealer A role; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/listings. Record the initial visible state and fixture resource IDs.
2. Open the indicated pending/complete/ineligible listing and perform approve/reject/review while a separate member/Admin profile makes the specified state change. Refresh public visibility and request audit evidence.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer suspension during review remains consistent.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-350 — ADMIN-LISTING-009

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; Dealer A role; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/listings. Record the initial visible state and fixture resource IDs.
2. Open the indicated pending/complete/ineligible listing and perform approve/reject/review while a separate member/Admin profile makes the specified state change. Refresh public visibility and request audit evidence.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Verification change during review remains consistent.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-351 — ADMIN-LISTING-010

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; Dealer A role; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/listings. Record the initial visible state and fixture resource IDs.
2. Open the indicated pending/complete/ineligible listing and perform approve/reject/review while a separate member/Admin profile makes the specified state change. Refresh public visibility and request audit evidence.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin listing actions audit logged.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-352 — ADMIN-ENQ-001

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; cross-dealer enquiry fixtures; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/enquiries. Record the initial visible state and fixture resource IDs.
2. Search by fixture name/phone/plate, choose status/dealer/date filters, Apply and use View on the relevant row. Compare all displayed fields and history to the fixture sheet, including after the indicated related state change.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin sees cross-dealer enquiries.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-353 — ADMIN-ENQ-002

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; cross-dealer enquiry fixtures; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/enquiries. Record the initial visible state and fixture resource IDs.
2. Search by fixture name/phone/plate, choose status/dealer/date filters, Apply and use View on the relevant row. Compare all displayed fields and history to the fixture sheet, including after the indicated related state change.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Correct customer name.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-354 — ADMIN-ENQ-003

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; cross-dealer enquiry fixtures; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/enquiries. Record the initial visible state and fixture resource IDs.
2. Search by fixture name/phone/plate, choose status/dealer/date filters, Apply and use View on the relevant row. Compare all displayed fields and history to the fixture sheet, including after the indicated related state change.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Correct customer phone.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-355 — ADMIN-ENQ-004

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; cross-dealer enquiry fixtures; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/enquiries. Record the initial visible state and fixture resource IDs.
2. Search by fixture name/phone/plate, choose status/dealer/date filters, Apply and use View on the relevant row. Compare all displayed fields and history to the fixture sheet, including after the indicated related state change.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Correct description.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-356 — ADMIN-ENQ-005

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; cross-dealer enquiry fixtures; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/enquiries. Record the initial visible state and fixture resource IDs.
2. Search by fixture name/phone/plate, choose status/dealer/date filters, Apply and use View on the relevant row. Compare all displayed fields and history to the fixture sheet, including after the indicated related state change.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Correct dealership.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-357 — ADMIN-ENQ-006

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; cross-dealer enquiry fixtures; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/enquiries. Record the initial visible state and fixture resource IDs.
2. Search by fixture name/phone/plate, choose status/dealer/date filters, Apply and use View on the relevant row. Compare all displayed fields and history to the fixture sheet, including after the indicated related state change.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Correct vehicle.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-358 — ADMIN-ENQ-007

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; cross-dealer enquiry fixtures; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/enquiries. Record the initial visible state and fixture resource IDs.
2. Search by fixture name/phone/plate, choose status/dealer/date filters, Apply and use View on the relevant row. Compare all displayed fields and history to the fixture sheet, including after the indicated related state change.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Correct status.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-359 — ADMIN-ENQ-008

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; cross-dealer enquiry fixtures; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/enquiries. Record the initial visible state and fixture resource IDs.
2. Search by fixture name/phone/plate, choose status/dealer/date filters, Apply and use View on the relevant row. Compare all displayed fields and history to the fixture sheet, including after the indicated related state change.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer status changes do not erase history.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-360 — ADMIN-ENQ-009

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; cross-dealer enquiry fixtures; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/enquiries. Record the initial visible state and fixture resource IDs.
2. Search by fixture name/phone/plate, choose status/dealer/date filters, Apply and use View on the relevant row. Compare all displayed fields and history to the fixture sheet, including after the indicated related state change.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Listing status changes do not erase history.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-361 — ADMIN-ENQ-010

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; cross-dealer enquiry fixtures; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/enquiries. Record the initial visible state and fixture resource IDs.
2. Search by fixture name/phone/plate, choose status/dealer/date filters, Apply and use View on the relevant row. Compare all displayed fields and history to the fixture sheet, including after the indicated related state change.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Member removal does not erase actor/history.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-362 — ADMIN-ENQ-011

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; cross-dealer enquiry fixtures; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/enquiries. Record the initial visible state and fixture resource IDs.
2. Search by fixture name/phone/plate, choose status/dealer/date filters, Apply and use View on the relevant row. Compare all displayed fields and history to the fixture sheet, including after the indicated related state change.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Filters/search/pagination correct.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-363 — ADMIN-ENQ-012

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J012.

Setup: Admin; cross-dealer enquiry fixtures; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/enquiries. Record the initial visible state and fixture resource IDs.
2. Search by fixture name/phone/plate, choose status/dealer/date filters, Apply and use View on the relevant row. Compare all displayed fields and history to the fixture sheet, including after the indicated related state change.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer members cannot access Admin enquiry aggregation APIs.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-364 — CROSS-001

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: ACTIVE dealer + ACTIVE listing → suspension produces defined public behavior without deleting listing data.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-365 — CROSS-002

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Suspended dealer + hidden ACTIVE listing → reinstatement follows defined restoration policy.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-366 — CROSS-003

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Suspension while RESERVED remains consistent.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-367 — CROSS-004

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Suspension while moderation pending follows explicit policy.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-368 — CROSS-005

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Suspension during enquiry submission safely resolves.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-369 — CROSS-006

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Suspension preserves existing enquiries.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-370 — CROSS-007

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer rejection with draft listings follows defined policy.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-371 — CROSS-008

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: ACTIVE saved car → SOLD handles Saved Cars correctly.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-372 — CROSS-009

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: ACTIVE enquiry → SOLD preserves history.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-373 — CROSS-010

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: ACTIVE enquiry → WITHDRAWN preserves history.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-374 — CROSS-011

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: ACTIVE enquiry → RESERVED preserves history.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-375 — CROSS-012

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: RESERVED vehicle existing enquiry can continue historical workflow where intended.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-376 — CROSS-013

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: SOLD → direct API reactivation rejected unless explicitly supported.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-377 — CROSS-014

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: WITHDRAWN invalid transition rejected.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-378 — CROSS-015

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J008.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF creates draft → STAFF removed → draft remains dealership-owned.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-379 — CROSS-016

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF creates draft → promoted MANAGER → can submit if otherwise eligible.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-380 — CROSS-017

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER submits → demoted STAFF before approval → moderation remains valid.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-381 — CROSS-018

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J008.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER CONTACTED → removed → enquiry actor/history preserved.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-382 — CROSS-019

Priority: P1. Agent result: FAIL. Bug: BUG-005. Journey: HUMAN-UAT-J015.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Member removed while mutation in flight remains safe.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-383 — CROSS-020

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J008.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Member dashboard open → OWNER revokes → next protected request denied.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-384 — CROSS-021

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer dashboard open → Admin suspends → next prohibited operation denied.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-385 — CROSS-022

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer reinstated + valid membership restores appropriate access.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-386 — CROSS-023

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer reinstated + member revoked during suspension remains denied.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-387 — CROSS-024

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J008.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Revoked member logs in as customer successfully but dealer access remains revoked.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-388 — CROSS-025

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J008.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Revoked member opens old dealer bookmark → dealer denied without destroying customer session.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-389 — CROSS-026

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J011.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Customer becomes dealer member while logged in without duplicate identity.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-390 — CROSS-027

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J011.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer member personally enquires with another dealership without employer contamination.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-391 — CROSS-028

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J011.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer member personally saves competitor car without employer visibility.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-392 — CROSS-029

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J009.

Setup: Profiles named in this exact scenario; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Dealer Team/Inventory/Enquiries plus Admin Dealers/Listings. Record the initial visible state and fixture resource IDs.
2. Keep the affected profile open, make the named related-entity transition in the second profile, then repeat the original action/read using the unchanged identity and resource ID. QA supplies the pre/post count and actor sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Employer suspension does not affect member's unrelated customer activity.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-393 — SEARCH-001

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: Anonymous visitor; dealer/Admin mutation profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /cars and /dealers/{dealerSlug}. Record the initial visible state and fixture resource IDs.
2. Record fixture visible IDs and available count; apply the named approval/sale/withdrawal/reservation/suspension/reinstatement, refresh both search and direct portfolio, and compare IDs/counts. Enter altered filter query in the collection for tampering checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Approved listing becomes searchable.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-394 — SEARCH-002

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: Anonymous visitor; dealer/Admin mutation profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /cars and /dealers/{dealerSlug}. Record the initial visible state and fixture resource IDs.
2. Record fixture visible IDs and available count; apply the named approval/sale/withdrawal/reservation/suspension/reinstatement, refresh both search and direct portfolio, and compare IDs/counts. Enter altered filter query in the collection for tampering checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: SOLD disappears search.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-395 — SEARCH-003

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: Anonymous visitor; dealer/Admin mutation profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /cars and /dealers/{dealerSlug}. Record the initial visible state and fixture resource IDs.
2. Record fixture visible IDs and available count; apply the named approval/sale/withdrawal/reservation/suspension/reinstatement, refresh both search and direct portfolio, and compare IDs/counts. Enter altered filter query in the collection for tampering checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: WITHDRAWN disappears search.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-396 — SEARCH-004

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: Anonymous visitor; dealer/Admin mutation profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /cars and /dealers/{dealerSlug}. Record the initial visible state and fixture resource IDs.
2. Record fixture visible IDs and available count; apply the named approval/sale/withdrawal/reservation/suspension/reinstatement, refresh both search and direct portfolio, and compare IDs/counts. Enter altered filter query in the collection for tampering checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: RESERVED search behavior follows policy.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-397 — SEARCH-005

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: Anonymous visitor; dealer/Admin mutation profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /cars and /dealers/{dealerSlug}. Record the initial visible state and fixture resource IDs.
2. Record fixture visible IDs and available count; apply the named approval/sale/withdrawal/reservation/suspension/reinstatement, refresh both search and direct portfolio, and compare IDs/counts. Enter altered filter query in the collection for tampering checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Suspended dealer listings follow suspension visibility policy.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-398 — SEARCH-006

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: Anonymous visitor; dealer/Admin mutation profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /cars and /dealers/{dealerSlug}. Record the initial visible state and fixture resource IDs.
2. Record fixture visible IDs and available count; apply the named approval/sale/withdrawal/reservation/suspension/reinstatement, refresh both search and direct portfolio, and compare IDs/counts. Enter altered filter query in the collection for tampering checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Reinstated dealer inventory returns according to policy.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-399 — SEARCH-007

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: Anonymous visitor; dealer/Admin mutation profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /cars and /dealers/{dealerSlug}. Record the initial visible state and fixture resource IDs.
2. Record fixture visible IDs and available count; apply the named approval/sale/withdrawal/reservation/suspension/reinstatement, refresh both search and direct portfolio, and compare IDs/counts. Enter altered filter query in the collection for tampering checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Public dealer count updates after approval.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-400 — SEARCH-008

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: Anonymous visitor; dealer/Admin mutation profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /cars and /dealers/{dealerSlug}. Record the initial visible state and fixture resource IDs.
2. Record fixture visible IDs and available count; apply the named approval/sale/withdrawal/reservation/suspension/reinstatement, refresh both search and direct portfolio, and compare IDs/counts. Enter altered filter query in the collection for tampering checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Count updates after SOLD.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-401 — SEARCH-009

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: Anonymous visitor; dealer/Admin mutation profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /cars and /dealers/{dealerSlug}. Record the initial visible state and fixture resource IDs.
2. Record fixture visible IDs and available count; apply the named approval/sale/withdrawal/reservation/suspension/reinstatement, refresh both search and direct portfolio, and compare IDs/counts. Enter altered filter query in the collection for tampering checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Count updates after WITHDRAWN.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-402 — SEARCH-010

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: Anonymous visitor; dealer/Admin mutation profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /cars and /dealers/{dealerSlug}. Record the initial visible state and fixture resource IDs.
2. Record fixture visible IDs and available count; apply the named approval/sale/withdrawal/reservation/suspension/reinstatement, refresh both search and direct portfolio, and compare IDs/counts. Enter altered filter query in the collection for tampering checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Filters never return non-public listing.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-403 — SEARCH-011

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: Anonymous visitor; dealer/Admin mutation profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /cars and /dealers/{dealerSlug}. Record the initial visible state and fixture resource IDs.
2. Record fixture visible IDs and available count; apply the named approval/sale/withdrawal/reservation/suspension/reinstatement, refresh both search and direct portfolio, and compare IDs/counts. Enter altered filter query in the collection for tampering checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Crafted search parameters cannot expose private listings.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-404 — SEARCH-012

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J010.

Setup: Anonymous visitor; dealer/Admin mutation profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /cars and /dealers/{dealerSlug}. Record the initial visible state and fixture resource IDs.
2. Record fixture visible IDs and available count; apply the named approval/sale/withdrawal/reservation/suspension/reinstatement, refresh both search and direct portfolio, and compare IDs/counts. Enter altered filter query in the collection for tampering checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Search and direct portfolio access enforce consistent visibility.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-405 — DATA-001

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J008.

Setup: QA operator plus affected member/customer/Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified lifecycle screen. Record the initial visible state and fixture resource IDs.
2. Operator records pre-state IDs/ownership/actor/timestamps/FK checks, you perform the named lifecycle/identity/membership change through UI, operator records post-state checks, and you reopen the corresponding customer/dealer/Admin history.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Membership revocation never cascades dealership listings.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-406 — DATA-002

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J008.

Setup: QA operator plus affected member/customer/Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified lifecycle screen. Record the initial visible state and fixture resource IDs.
2. Operator records pre-state IDs/ownership/actor/timestamps/FK checks, you perform the named lifecycle/identity/membership change through UI, operator records post-state checks, and you reopen the corresponding customer/dealer/Admin history.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Membership changes never delete enquiries.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-407 — DATA-003

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: QA operator plus affected member/customer/Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified lifecycle screen. Record the initial visible state and fixture resource IDs.
2. Operator records pre-state IDs/ownership/actor/timestamps/FK checks, you perform the named lifecycle/identity/membership change through UI, operator records post-state checks, and you reopen the corresponding customer/dealer/Admin history.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Listing lifecycle changes never delete enquiry history.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-408 — DATA-004

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: QA operator plus affected member/customer/Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified lifecycle screen. Record the initial visible state and fixture resource IDs.
2. Operator records pre-state IDs/ownership/actor/timestamps/FK checks, you perform the named lifecycle/identity/membership change through UI, operator records post-state checks, and you reopen the corresponding customer/dealer/Admin history.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer suspension never destroys historical data.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-409 — DATA-005

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: QA operator plus affected member/customer/Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified lifecycle screen. Record the initial visible state and fixture resource IDs.
2. Operator records pre-state IDs/ownership/actor/timestamps/FK checks, you perform the named lifecycle/identity/membership change through UI, operator records post-state checks, and you reopen the corresponding customer/dealer/Admin history.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Foreign keys remain valid across lifecycle transitions.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-410 — DATA-006

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: QA operator plus affected member/customer/Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified lifecycle screen. Record the initial visible state and fixture resource IDs.
2. Operator records pre-state IDs/ownership/actor/timestamps/FK checks, you perform the named lifecycle/identity/membership change through UI, operator records post-state checks, and you reopen the corresponding customer/dealer/Admin history.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Mixed OTP/Google/invite flows do not create duplicate users.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-411 — DATA-007

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: QA operator plus affected member/customer/Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified lifecycle screen. Record the initial visible state and fixture resource IDs.
2. Operator records pre-state IDs/ownership/actor/timestamps/FK checks, you perform the named lifecycle/identity/membership change through UI, operator records post-state checks, and you reopen the corresponding customer/dealer/Admin history.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Retry/races do not create duplicate dealerships.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-412 — DATA-008

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: QA operator plus affected member/customer/Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified lifecycle screen. Record the initial visible state and fixture resource IDs.
2. Operator records pre-state IDs/ownership/actor/timestamps/FK checks, you perform the named lifecycle/identity/membership change through UI, operator records post-state checks, and you reopen the corresponding customer/dealer/Admin history.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Duplicate memberships prevented at DB level.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-413 — DATA-009

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: QA operator plus affected member/customer/Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified lifecycle screen. Record the initial visible state and fixture resource IDs.
2. Operator records pre-state IDs/ownership/actor/timestamps/FK checks, you perform the named lifecycle/identity/membership change through UI, operator records post-state checks, and you reopen the corresponding customer/dealer/Admin history.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Duplicate lifecycle operations safely rejected/idempotent.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-414 — DATA-010

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J008.

Setup: QA operator plus affected member/customer/Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified lifecycle screen. Record the initial visible state and fixture resource IDs.
2. Operator records pre-state IDs/ownership/actor/timestamps/FK checks, you perform the named lifecycle/identity/membership change through UI, operator records post-state checks, and you reopen the corresponding customer/dealer/Admin history.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Audit records survive actor membership loss.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-415 — DATA-011

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: QA operator plus affected member/customer/Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified lifecycle screen. Record the initial visible state and fixture resource IDs.
2. Operator records pre-state IDs/ownership/actor/timestamps/FK checks, you perform the named lifecycle/identity/membership change through UI, operator records post-state checks, and you reopen the corresponding customer/dealer/Admin history.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Public read model is not authoritative lifecycle source.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-416 — API-SEC-001

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified authenticated role or auth cleared; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied Postman collection. Record the initial visible state and fixture resource IDs.
2. Send the exact resource operation under the stated identity, substituting a foreign/unknown/malformed ID or unexpected field where requested. Compare HTTP/body with expected denial and confirm the target is unchanged on the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Unauthenticated protected API requests fail.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-417 — API-SEC-002

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified authenticated role or auth cleared; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied Postman collection. Record the initial visible state and fixture resource IDs.
2. Send the exact resource operation under the stated identity, substituting a foreign/unknown/malformed ID or unexpected field where requested. Compare HTTP/body with expected denial and confirm the target is unchanged on the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Customer cannot call dealer-only API.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-418 — API-SEC-003

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified authenticated role or auth cleared; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied Postman collection. Record the initial visible state and fixture resource IDs.
2. Send the exact resource operation under the stated identity, substituting a foreign/unknown/malformed ID or unexpected field where requested. Compare HTTP/body with expected denial and confirm the target is unchanged on the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF cannot call MANAGER-only API.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-419 — API-SEC-004

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified authenticated role or auth cleared; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied Postman collection. Record the initial visible state and fixture resource IDs.
2. Send the exact resource operation under the stated identity, substituting a foreign/unknown/malformed ID or unexpected field where requested. Compare HTTP/body with expected denial and confirm the target is unchanged on the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MANAGER cannot call OWNER-only API.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-420 — API-SEC-005

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified authenticated role or auth cleared; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied Postman collection. Record the initial visible state and fixture resource IDs.
2. Send the exact resource operation under the stated identity, substituting a foreign/unknown/malformed ID or unexpected field where requested. Compare HTTP/body with expected denial and confirm the target is unchanged on the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER cannot call Admin-only API.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-421 — API-SEC-006

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified authenticated role or auth cleared; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied Postman collection. Record the initial visible state and fixture resource IDs.
2. Send the exact resource operation under the stated identity, substituting a foreign/unknown/malformed ID or unexpected field where requested. Compare HTTP/body with expected denial and confirm the target is unchanged on the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer A cannot access Dealer B by changing IDs.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-422 — API-SEC-007

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified authenticated role or auth cleared; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied Postman collection. Record the initial visible state and fixture resource IDs.
2. Send the exact resource operation under the stated identity, substituting a foreign/unknown/malformed ID or unexpected field where requested. Compare HTTP/body with expected denial and confirm the target is unchanged on the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Customer A cannot access Customer B by changing IDs.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-423 — API-SEC-008

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified authenticated role or auth cleared; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied Postman collection. Record the initial visible state and fixture resource IDs.
2. Send the exact resource operation under the stated identity, substituting a foreign/unknown/malformed ID or unexpected field where requested. Compare HTTP/body with expected denial and confirm the target is unchanged on the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Invalid IDs do not leak internal errors.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-424 — API-SEC-009

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified authenticated role or auth cleared; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied Postman collection. Record the initial visible state and fixture resource IDs.
2. Send the exact resource operation under the stated identity, substituting a foreign/unknown/malformed ID or unexpected field where requested. Compare HTTP/body with expected denial and confirm the target is unchanged on the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Unexpected privileged fields rejected.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-425 — API-SEC-010

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified authenticated role or auth cleared; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied Postman collection. Record the initial visible state and fixture resource IDs.
2. Send the exact resource operation under the stated identity, substituting a foreign/unknown/malformed ID or unexpected field where requested. Compare HTTP/body with expected denial and confirm the target is unchanged on the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Mass assignment cannot change dealer/role/verification/lifecycle ownership.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-426 — API-SEC-011

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified authenticated role or auth cleared; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied Postman collection. Record the initial visible state and fixture resource IDs.
2. Send the exact resource operation under the stated identity, substituting a foreign/unknown/malformed ID or unexpected field where requested. Compare HTTP/body with expected denial and confirm the target is unchanged on the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Pagination/filter parameters validated.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-427 — API-SEC-012

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified authenticated role or auth cleared; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied Postman collection. Record the initial visible state and fixture resource IDs.
2. Send the exact resource operation under the stated identity, substituting a foreign/unknown/malformed ID or unexpected field where requested. Compare HTTP/body with expected denial and confirm the target is unchanged on the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Sensitive auth/public endpoints rate limited appropriately.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-428 — API-SEC-013

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified authenticated role or auth cleared; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied Postman collection. Record the initial visible state and fixture resource IDs.
2. Send the exact resource operation under the stated identity, substituting a foreign/unknown/malformed ID or unexpected field where requested. Compare HTTP/body with expected denial and confirm the target is unchanged on the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Revoked authentication/session tokens cannot retain prohibited access.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-429 — API-SEC-014

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified authenticated role or auth cleared; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied Postman collection. Record the initial visible state and fixture resource IDs.
2. Send the exact resource operation under the stated identity, substituting a foreign/unknown/malformed ID or unexpected field where requested. Compare HTTP/body with expected denial and confirm the target is unchanged on the QA fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Server errors do not leak stack traces/secrets/SQL/environment values.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-430 — STORAGE-001

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: QA storage operator; Dealer A/B; anonymous; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Upload/document/media request collection. Record the initial visible state and fixture resource IDs.
2. Request upload credentials for the specified resource/type/size, attempt the altered/foreign commit or private fetch in the indicated profile, and inspect result plus object ownership/cleanup on QA’s sanitized storage sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Presigned upload restricts intended file type/size.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-431 — STORAGE-002

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: QA storage operator; Dealer A/B; anonymous; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Upload/document/media request collection. Record the initial visible state and fixture resource IDs.
2. Request upload credentials for the specified resource/type/size, attempt the altered/foreign commit or private fetch in the indicated profile, and inspect result plus object ownership/cleanup on QA’s sanitized storage sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Upload authorization cannot be reused across unauthorized resources.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-432 — STORAGE-003

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: QA storage operator; Dealer A/B; anonymous; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Upload/document/media request collection. Record the initial visible state and fixture resource IDs.
2. Request upload credentials for the specified resource/type/size, attempt the altered/foreign commit or private fetch in the indicated profile, and inspect result plus object ownership/cleanup on QA’s sanitized storage sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Upload commit validates ownership.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-433 — STORAGE-004

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: QA storage operator; Dealer A/B; anonymous; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Upload/document/media request collection. Record the initial visible state and fixture resource IDs.
2. Request upload credentials for the specified resource/type/size, attempt the altered/foreign commit or private fetch in the indicated profile, and inspect result plus object ownership/cleanup on QA’s sanitized storage sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Removed uploads follow cleanup policy.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-434 — STORAGE-005

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: QA storage operator; Dealer A/B; anonymous; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Upload/document/media request collection. Record the initial visible state and fixture resource IDs.
2. Request upload credentials for the specified resource/type/size, attempt the altered/foreign commit or private fetch in the indicated profile, and inspect result plus object ownership/cleanup on QA’s sanitized storage sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Missing object does not crash pages.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-435 — STORAGE-006

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: QA storage operator; Dealer A/B; anonymous; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Upload/document/media request collection. Record the initial visible state and fixture resource IDs.
2. Request upload credentials for the specified resource/type/size, attempt the altered/foreign commit or private fetch in the indicated profile, and inspect result plus object ownership/cleanup on QA’s sanitized storage sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Private verification documents cannot be publicly fetched.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-436 — STORAGE-007

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: QA storage operator; Dealer A/B; anonymous; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Upload/document/media request collection. Record the initial visible state and fixture resource IDs.
2. Request upload credentials for the specified resource/type/size, attempt the altered/foreign commit or private fetch in the indicated profile, and inspect result plus object ownership/cleanup on QA’s sanitized storage sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Public vehicle media exposed only through intended mechanisms.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-437 — STORAGE-008

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: QA storage operator; Dealer A/B; anonymous; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Upload/document/media request collection. Record the initial visible state and fixture resource IDs.
2. Request upload credentials for the specified resource/type/size, attempt the altered/foreign commit or private fetch in the indicated profile, and inspect result plus object ownership/cleanup on QA’s sanitized storage sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Object keys/URLs do not expose sensitive information.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-443 — RECOVERY-001

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Affected user profile; QA failure operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified public/dealer/auth/enquiry UI. Record the initial visible state and fixture resource IDs.
2. Operator disconnects only the named isolated dependency. Perform the indicated action and record the error; restore dependency, retry once, refresh/back and compare final row/history/auth state using the fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: API unavailable during public browsing gives graceful UX.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-444 — RECOVERY-002

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Affected user profile; QA failure operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified public/dealer/auth/enquiry UI. Record the initial visible state and fixture resource IDs.
2. Operator disconnects only the named isolated dependency. Perform the indicated action and record the error; restore dependency, retry once, refresh/back and compare final row/history/auth state using the fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: API unavailable during listing save does not falsely report success.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-445 — RECOVERY-003

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Affected user profile; QA failure operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified public/dealer/auth/enquiry UI. Record the initial visible state and fixture resource IDs.
2. Operator disconnects only the named isolated dependency. Perform the indicated action and record the error; restore dependency, retry once, refresh/back and compare final row/history/auth state using the fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: API unavailable during enquiry submission supports safe retry.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-446 — RECOVERY-004

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Affected user profile; QA failure operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified public/dealer/auth/enquiry UI. Record the initial visible state and fixture resource IDs.
2. Operator disconnects only the named isolated dependency. Perform the indicated action and record the error; restore dependency, retry once, refresh/back and compare final row/history/auth state using the fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Database outage produces controlled error.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-447 — RECOVERY-005

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Affected user profile; QA failure operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified public/dealer/auth/enquiry UI. Record the initial visible state and fixture resource IDs.
2. Operator disconnects only the named isolated dependency. Perform the indicated action and record the error; restore dependency, retry once, refresh/back and compare final row/history/auth state using the fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Storage outage does not corrupt listing.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-448 — RECOVERY-006

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Affected user profile; QA failure operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified public/dealer/auth/enquiry UI. Record the initial visible state and fixture resource IDs.
2. Operator disconnects only the named isolated dependency. Perform the indicated action and record the error; restore dependency, retry once, refresh/back and compare final row/history/auth state using the fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OTP outage does not create partially authenticated session.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-449 — RECOVERY-007

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Affected user profile; QA failure operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified public/dealer/auth/enquiry UI. Record the initial visible state and fixture resource IDs.
2. Operator disconnects only the named isolated dependency. Perform the indicated action and record the error; restore dependency, retry once, refresh/back and compare final row/history/auth state using the fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Google OAuth failure is recoverable.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-450 — RECOVERY-008

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Affected user profile; QA failure operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified public/dealer/auth/enquiry UI. Record the initial visible state and fixture resource IDs.
2. Operator disconnects only the named isolated dependency. Perform the indicated action and record the error; restore dependency, retry once, refresh/back and compare final row/history/auth state using the fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Email failure does not corrupt onboarding.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-451 — RECOVERY-009

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Affected user profile; QA failure operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified public/dealer/auth/enquiry UI. Record the initial visible state and fixture resource IDs.
2. Operator disconnects only the named isolated dependency. Perform the indicated action and record the error; restore dependency, retry once, refresh/back and compare final row/history/auth state using the fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Browser refresh during critical flow recovers safely.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-452 — RECOVERY-010

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Affected user profile; QA failure operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified public/dealer/auth/enquiry UI. Record the initial visible state and fixture resource IDs.
2. Operator disconnects only the named isolated dependency. Perform the indicated action and record the error; restore dependency, retry once, refresh/back and compare final row/history/auth state using the fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Browser Back does not repeat lifecycle mutation.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-453 — RECOVERY-011

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Affected user profile; QA failure operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified public/dealer/auth/enquiry UI. Record the initial visible state and fixture resource IDs.
2. Operator disconnects only the named isolated dependency. Perform the indicated action and record the error; restore dependency, retry once, refresh/back and compare final row/history/auth state using the fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Double-click mutation does not duplicate operation.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-454 — RECOVERY-012

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Affected user profile; QA failure operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified public/dealer/auth/enquiry UI. Record the initial visible state and fixture resource IDs.
2. Operator disconnects only the named isolated dependency. Perform the indicated action and record the error; restore dependency, retry once, refresh/back and compare final row/history/auth state using the fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Network timeout + retry safe.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-455 — RECOVERY-013

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Affected user profile; QA failure operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified public/dealer/auth/enquiry UI. Record the initial visible state and fixture resource IDs.
2. Operator disconnects only the named isolated dependency. Perform the indicated action and record the error; restore dependency, retry once, refresh/back and compare final row/history/auth state using the fixture sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Server restart does not unexpectedly corrupt persisted business state.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-456 — CONCURRENCY-001

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Two named role profiles; QA race operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The exact mutation UI/API pair. Record the initial visible state and fixture resource IDs.
2. Operator prepares barriers/locks for the specified pair of requests. Execute both operations, release the barrier, record both responses and authoritative final state/audit. For removal-vs-mutation remove only after a lock wait is proved.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Two staff editing same draft do not silently corrupt critical data.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-457 — CONCURRENCY-002

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Two named role profiles; QA race operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The exact mutation UI/API pair. Record the initial visible state and fixture resource IDs.
2. Operator prepares barriers/locks for the specified pair of requests. Execute both operations, release the barrier, record both responses and authoritative final state/audit. For removal-vs-mutation remove only after a lock wait is proved.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Two managers SOLD same vehicle remains consistent.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-458 — CONCURRENCY-003

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Two named role profiles; QA race operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The exact mutation UI/API pair. Record the initial visible state and fixture resource IDs.
2. Operator prepares barriers/locks for the specified pair of requests. Execute both operations, release the barrier, record both responses and authoritative final state/audit. For removal-vs-mutation remove only after a lock wait is proved.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: RESERVED vs SOLD race results in valid state.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-459 — CONCURRENCY-004

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Two named role profiles; QA race operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The exact mutation UI/API pair. Record the initial visible state and fixture resource IDs.
2. Operator prepares barriers/locks for the specified pair of requests. Execute both operations, release the barrier, record both responses and authoritative final state/audit. For removal-vs-mutation remove only after a lock wait is proved.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin approval vs dealer edit/submit remains valid.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-460 — CONCURRENCY-005

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Two named role profiles; QA race operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The exact mutation UI/API pair. Record the initial visible state and fixture resource IDs.
2. Operator prepares barriers/locks for the specified pair of requests. Execute both operations, release the barrier, record both responses and authoritative final state/audit. For removal-vs-mutation remove only after a lock wait is proved.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer suspension vs manager submit prevents invalid publication.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-461 — CONCURRENCY-006

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Two named role profiles; QA race operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The exact mutation UI/API pair. Record the initial visible state and fixture resource IDs.
2. Operator prepares barriers/locks for the specified pair of requests. Execute both operations, release the barrier, record both responses and authoritative final state/audit. For removal-vs-mutation remove only after a lock wait is proved.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: CONTACTED vs CLOSED race follows valid transition.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-462 — CONCURRENCY-007

Priority: P1. Agent result: FAIL. Bug: BUG-005. Journey: HUMAN-UAT-J015.

Setup: Two named role profiles; QA race operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The exact mutation UI/API pair. Record the initial visible state and fixture resource IDs.
2. Operator prepares barriers/locks for the specified pair of requests. Execute both operations, release the barrier, record both responses and authoritative final state/audit. For removal-vs-mutation remove only after a lock wait is proved.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Member removal vs member mutation remains safe.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-463 — CONCURRENCY-008

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Two named role profiles; QA race operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The exact mutation UI/API pair. Record the initial visible state and fixture resource IDs.
2. Operator prepares barriers/locks for the specified pair of requests. Execute both operations, release the barrier, record both responses and authoritative final state/audit. For removal-vs-mutation remove only after a lock wait is proved.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Concurrent Admin dealer verification actions remain valid.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-464 — CONCURRENCY-009

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Two named role profiles; QA race operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The exact mutation UI/API pair. Record the initial visible state and fixture resource IDs.
2. Operator prepares barriers/locks for the specified pair of requests. Execute both operations, release the barrier, record both responses and authoritative final state/audit. For removal-vs-mutation remove only after a lock wait is proved.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Simultaneous legitimate customer enquiries retained.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-465 — CONCURRENCY-010

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J015.

Setup: Two named role profiles; QA race operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The exact mutation UI/API pair. Record the initial visible state and fixture resource IDs.
2. Operator prepares barriers/locks for the specified pair of requests. Execute both operations, release the barrier, record both responses and authoritative final state/audit. For removal-vs-mutation remove only after a lock wait is proved.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Concurrent invitation acceptance cannot duplicate membership.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-500 — PROD-001

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA deployment/provider operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Isolated production-like deployment settings and hosted UAT URL. Record the initial visible state and fixture resource IDs.
2. Operator runs the exact forbidden/required configuration probe without printing secret values, or you exercise the specified live test-provider callback/message/upload. Compare the resource origin and acceptance/refusal to the approved configuration sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Production starts without local-only services.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-501 — PROD-002

Priority: P1. Agent result: FAIL. Bug: BUG-006. Journey: HUMAN-UAT-J014.

Setup: QA deployment/provider operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Isolated production-like deployment settings and hosted UAT URL. Record the initial visible state and fixture resource IDs.
2. Operator runs the exact forbidden/required configuration probe without printing secret values, or you exercise the specified live test-provider callback/message/upload. Compare the resource origin and acceptance/refusal to the approved configuration sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Production cannot use MinIO accidentally.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-502 — PROD-003

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA deployment/provider operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Isolated production-like deployment settings and hosted UAT URL. Record the initial visible state and fixture resource IDs.
2. Operator runs the exact forbidden/required configuration probe without printing secret values, or you exercise the specified live test-provider callback/message/upload. Compare the resource origin and acceptance/refusal to the approved configuration sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Production cannot use dummy OTP accidentally.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-503 — PROD-004

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA deployment/provider operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Isolated production-like deployment settings and hosted UAT URL. Record the initial visible state and fixture resource IDs.
2. Operator runs the exact forbidden/required configuration probe without printing secret values, or you exercise the specified live test-provider callback/message/upload. Compare the resource origin and acceptance/refusal to the approved configuration sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Production cannot use Mailpit accidentally.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-504 — PROD-005

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA deployment/provider operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Isolated production-like deployment settings and hosted UAT URL. Record the initial visible state and fixture resource IDs.
2. Operator runs the exact forbidden/required configuration probe without printing secret values, or you exercise the specified live test-provider callback/message/upload. Compare the resource origin and acceptance/refusal to the approved configuration sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Production cannot use development seed data.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-505 — PROD-006

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA deployment/provider operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Isolated production-like deployment settings and hosted UAT URL. Record the initial visible state and fixture resource IDs.
2. Operator runs the exact forbidden/required configuration probe without printing secret values, or you exercise the specified live test-provider callback/message/upload. Compare the resource origin and acceptance/refusal to the approved configuration sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Development cannot mutate production resources.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-506 — PROD-007

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA deployment/provider operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Isolated production-like deployment settings and hosted UAT URL. Record the initial visible state and fixture resource IDs.
2. Operator runs the exact forbidden/required configuration probe without printing secret values, or you exercise the specified live test-provider callback/message/upload. Compare the resource origin and acceptance/refusal to the approved configuration sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Production DB points to intended DB.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-507 — PROD-008

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA deployment/provider operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Isolated production-like deployment settings and hosted UAT URL. Record the initial visible state and fixture resource IDs.
2. Operator runs the exact forbidden/required configuration probe without printing secret values, or you exercise the specified live test-provider callback/message/upload. Compare the resource origin and acceptance/refusal to the approved configuration sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Storage points to intended production resources.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-508 — PROD-009

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA deployment/provider operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Isolated production-like deployment settings and hosted UAT URL. Record the initial visible state and fixture resource IDs.
2. Operator runs the exact forbidden/required configuration probe without printing secret values, or you exercise the specified live test-provider callback/message/upload. Compare the resource origin and acceptance/refusal to the approved configuration sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Email sender configuration correct.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-509 — PROD-010

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA deployment/provider operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Isolated production-like deployment settings and hosted UAT URL. Record the initial visible state and fixture resource IDs.
2. Operator runs the exact forbidden/required configuration probe without printing secret values, or you exercise the specified live test-provider callback/message/upload. Compare the resource origin and acceptance/refusal to the approved configuration sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Google OAuth callbacks correct.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-510 — PROD-011

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA deployment/provider operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Isolated production-like deployment settings and hosted UAT URL. Record the initial visible state and fixture resource IDs.
2. Operator runs the exact forbidden/required configuration probe without printing secret values, or you exercise the specified live test-provider callback/message/upload. Compare the resource origin and acceptance/refusal to the approved configuration sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: MSG91/WhatsApp OTP production configuration works.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-511 — PROD-012

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA deployment/provider operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Isolated production-like deployment settings and hosted UAT URL. Record the initial visible state and fixture resource IDs.
2. Operator runs the exact forbidden/required configuration probe without printing secret values, or you exercise the specified live test-provider callback/message/upload. Compare the resource origin and acceptance/refusal to the approved configuration sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Secrets absent from client bundle/repository.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-512 — PROD-013

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA deployment/provider operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Isolated production-like deployment settings and hosted UAT URL. Record the initial visible state and fixture resource IDs.
2. Operator runs the exact forbidden/required configuration probe without printing secret values, or you exercise the specified live test-provider callback/message/upload. Compare the resource origin and acceptance/refusal to the approved configuration sheet.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Debug/docs/internal endpoints follow production policy.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-513 — DEPLOY-001

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA migration/backup operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Isolated copied pre-migration or restored DB/application. Record the initial visible state and fixture resource IDs.
2. Operator executes the specified migration/failure/backup/restore case and supplies before/after row/role/FK evidence. You repeat login, workspace access, listing visibility and enquiry history against the restored app; do not use live production.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Production migrations run on production-like DB.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-514 — DEPLOY-002

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA migration/backup operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Isolated copied pre-migration or restored DB/application. Record the initial visible state and fixture resource IDs.
2. Operator executes the specified migration/failure/backup/restore case and supplies before/after row/role/FK evidence. You repeat login, workspace access, listing visibility and enquiry history against the restored app; do not use live production.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Single-owner → OWNER membership migration correct.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-515 — DEPLOY-003

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA migration/backup operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Isolated copied pre-migration or restored DB/application. Record the initial visible state and fixture resource IDs.
2. Operator executes the specified migration/failure/backup/restore case and supplies before/after row/role/FK evidence. You repeat login, workspace access, listing visibility and enquiry history against the restored app; do not use live production.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Migration creates no duplicate users/dealers.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-516 — DEPLOY-004

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA migration/backup operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Isolated copied pre-migration or restored DB/application. Record the initial visible state and fixture resource IDs.
2. Operator executes the specified migration/failure/backup/restore case and supplies before/after row/role/FK evidence. You repeat login, workspace access, listing visibility and enquiry history against the restored app; do not use live production.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Migration preserves listings/enquiries/documents.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-517 — DEPLOY-005

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA migration/backup operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Isolated copied pre-migration or restored DB/application. Record the initial visible state and fixture resource IDs.
2. Operator executes the specified migration/failure/backup/restore case and supplies before/after row/role/FK evidence. You repeat login, workspace access, listing visibility and enquiry history against the restored app; do not use live production.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Deployment/migration ordering remains compatible.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-518 — DEPLOY-006

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA migration/backup operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Isolated copied pre-migration or restored DB/application. Record the initial visible state and fixture resource IDs.
2. Operator executes the specified migration/failure/backup/restore case and supplies before/after row/role/FK evidence. You repeat login, workspace access, listing visibility and enquiry history against the restored app; do not use live production.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Failed migration has documented recovery strategy.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-519 — DEPLOY-007

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA migration/backup operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Isolated copied pre-migration or restored DB/application. Record the initial visible state and fixture resource IDs.
2. Operator executes the specified migration/failure/backup/restore case and supplies before/after row/role/FK evidence. You repeat login, workspace access, listing visibility and enquiry history against the restored app; do not use live production.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Seed scripts cannot accidentally execute against production.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-520 — DEPLOY-008

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA migration/backup operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Isolated copied pre-migration or restored DB/application. Record the initial visible state and fixture resource IDs.
2. Operator executes the specified migration/failure/backup/restore case and supplies before/after row/role/FK evidence. You repeat login, workspace access, listing visibility and enquiry history against the restored app; do not use live production.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: DB indexes support critical queries.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-521 — DEPLOY-009

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA migration/backup operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Isolated copied pre-migration or restored DB/application. Record the initial visible state and fixture resource IDs.
2. Operator executes the specified migration/failure/backup/restore case and supplies before/after row/role/FK evidence. You repeat login, workspace access, listing visibility and enquiry history against the restored app; do not use live production.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Backup/restore procedure tested.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-522 — DEPLOY-010

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA migration/backup operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Isolated copied pre-migration or restored DB/application. Record the initial visible state and fixture resource IDs.
2. Operator executes the specified migration/failure/backup/restore case and supplies before/after row/role/FK evidence. You repeat login, workspace access, listing visibility and enquiry history against the restored app; do not use live production.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Restored DB preserves lifecycle and authorization relationships.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-523 — OBS-001

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA operations operator; actor performing the workflow; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified workflow and redacted telemetry viewer. Record the initial visible state and fixture resource IDs.
2. Trigger the exact operation/failure, note its timestamp/request ID, and ask operator to retrieve correlated request/audit/error/health evidence. Verify actor/state and absence of OTP/token/private URLs without copying credentials.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Production requests have useful request/correlation IDs.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-524 — OBS-002

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA operations operator; actor performing the workflow; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified workflow and redacted telemetry viewer. Record the initial visible state and fixture resource IDs.
2. Trigger the exact operation/failure, note its timestamp/request ID, and ask operator to retrieve correlated request/audit/error/health evidence. Verify actor/state and absence of OTP/token/private URLs without copying credentials.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Authentication failures diagnosable without secrets.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-525 — OBS-003

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA operations operator; actor performing the workflow; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified workflow and redacted telemetry viewer. Record the initial visible state and fixture resource IDs.
2. Trigger the exact operation/failure, note its timestamp/request ID, and ask operator to retrieve correlated request/audit/error/health evidence. Verify actor/state and absence of OTP/token/private URLs without copying credentials.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Authorization failures observable.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-526 — OBS-004

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA operations operator; actor performing the workflow; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified workflow and redacted telemetry viewer. Record the initial visible state and fixture resource IDs.
2. Trigger the exact operation/failure, note its timestamp/request ID, and ask operator to retrieve correlated request/audit/error/health evidence. Verify actor/state and absence of OTP/token/private URLs without copying credentials.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer suspension traceable.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-527 — OBS-005

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA operations operator; actor performing the workflow; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified workflow and redacted telemetry viewer. Record the initial visible state and fixture resource IDs.
2. Trigger the exact operation/failure, note its timestamp/request ID, and ask operator to retrieve correlated request/audit/error/health evidence. Verify actor/state and absence of OTP/token/private URLs without copying credentials.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Member permission changes traceable.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-528 — OBS-006

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA operations operator; actor performing the workflow; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified workflow and redacted telemetry viewer. Record the initial visible state and fixture resource IDs.
2. Trigger the exact operation/failure, note its timestamp/request ID, and ask operator to retrieve correlated request/audit/error/health evidence. Verify actor/state and absence of OTP/token/private URLs without copying credentials.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Listing lifecycle traceable.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-529 — OBS-007

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA operations operator; actor performing the workflow; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified workflow and redacted telemetry viewer. Record the initial visible state and fixture resource IDs.
2. Trigger the exact operation/failure, note its timestamp/request ID, and ask operator to retrieve correlated request/audit/error/health evidence. Verify actor/state and absence of OTP/token/private URLs without copying credentials.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Enquiry lifecycle traceable.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-530 — OBS-008

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA operations operator; actor performing the workflow; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified workflow and redacted telemetry viewer. Record the initial visible state and fixture resource IDs.
2. Trigger the exact operation/failure, note its timestamp/request ID, and ask operator to retrieve correlated request/audit/error/health evidence. Verify actor/state and absence of OTP/token/private URLs without copying credentials.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin actions traceable.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-531 — OBS-009

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA operations operator; actor performing the workflow; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified workflow and redacted telemetry viewer. Record the initial visible state and fixture resource IDs.
2. Trigger the exact operation/failure, note its timestamp/request ID, and ask operator to retrieve correlated request/audit/error/health evidence. Verify actor/state and absence of OTP/token/private URLs without copying credentials.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Unexpected 5xx captured.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-532 — OBS-010

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA operations operator; actor performing the workflow; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified workflow and redacted telemetry viewer. Record the initial visible state and fixture resource IDs.
2. Trigger the exact operation/failure, note its timestamp/request ID, and ask operator to retrieve correlated request/audit/error/health evidence. Verify actor/state and absence of OTP/token/private URLs without copying credentials.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Logs contain no OTP/token/password/private-document leakage.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-533 — OBS-011

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA operations operator; actor performing the workflow; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified workflow and redacted telemetry viewer. Record the initial visible state and fixture resource IDs.
2. Trigger the exact operation/failure, note its timestamp/request ID, and ask operator to retrieve correlated request/audit/error/health evidence. Verify actor/state and absence of OTP/token/private URLs without copying credentials.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Health endpoint reflects service health.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-534 — OBS-012

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J014.

Setup: QA operations operator; actor performing the workflow; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The specified workflow and redacted telemetry viewer. Record the initial visible state and fixture resource IDs.
2. Trigger the exact operation/failure, note its timestamp/request ID, and ask operator to retrieve correlated request/audit/error/health evidence. Verify actor/state and absence of OTP/token/private URLs without copying credentials.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Failed workflow can be traced end-to-end.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-535 — ABUSE-001

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified attacker-like test identity; QA rate operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied request collection and relevant private bookmark. Record the initial visible state and fixture resource IDs.
2. Repeat or manipulate only the named phone/IP/role/dealer/status/invitation/membership/client field in the disposable environment. Verify refusal/rate window and unchanged target state; do not attack a production system.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OTP abuse rate-limited.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-536 — ABUSE-002

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified attacker-like test identity; QA rate operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied request collection and relevant private bookmark. Record the initial visible state and fixture resource IDs.
2. Repeat or manipulate only the named phone/IP/role/dealer/status/invitation/membership/client field in the disposable environment. Verify refusal/rate window and unchanged target state; do not attack a production system.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Enquiry spam appropriately protected.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-537 — ABUSE-003

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified attacker-like test identity; QA rate operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied request collection and relevant private bookmark. Record the initial visible state and fixture resource IDs.
2. Repeat or manipulate only the named phone/IP/role/dealer/status/invitation/membership/client field in the disposable environment. Verify refusal/rate window and unchanged target state; do not attack a production system.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Automated listing submission cannot bypass dealer verification.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-538 — ABUSE-004

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified attacker-like test identity; QA rate operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied request collection and relevant private bookmark. Record the initial visible state and fixture resource IDs.
2. Repeat or manipulate only the named phone/IP/role/dealer/status/invitation/membership/client field in the disposable environment. Verify refusal/rate window and unchanged target state; do not attack a production system.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Frontend role tampering cannot elevate privilege.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-539 — ABUSE-005

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified attacker-like test identity; QA rate operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied request collection and relevant private bookmark. Record the initial visible state and fixture resource IDs.
2. Repeat or manipulate only the named phone/IP/role/dealer/status/invitation/membership/client field in the disposable environment. Verify refusal/rate window and unchanged target state; do not attack a production system.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer ID tampering cannot change tenant.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-540 — ABUSE-006

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified attacker-like test identity; QA rate operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied request collection and relevant private bookmark. Record the initial visible state and fixture resource IDs.
2. Repeat or manipulate only the named phone/IP/role/dealer/status/invitation/membership/client field in the disposable environment. Verify refusal/rate window and unchanged target state; do not attack a production system.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Listing status payload tampering cannot bypass transitions.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-541 — ABUSE-007

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified attacker-like test identity; QA rate operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied request collection and relevant private bookmark. Record the initial visible state and fixture resource IDs.
2. Repeat or manipulate only the named phone/IP/role/dealer/status/invitation/membership/client field in the disposable environment. Verify refusal/rate window and unchanged target state; do not attack a production system.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Enquiry status tampering cannot bypass transitions.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-542 — ABUSE-008

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified attacker-like test identity; QA rate operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied request collection and relevant private bookmark. Record the initial visible state and fixture resource IDs.
2. Repeat or manipulate only the named phone/IP/role/dealer/status/invitation/membership/client field in the disposable environment. Verify refusal/rate window and unchanged target state; do not attack a production system.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Invitation role manipulation cannot self-promote OWNER.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-543 — ABUSE-009

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified attacker-like test identity; QA rate operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied request collection and relevant private bookmark. Record the initial visible state and fixture resource IDs.
2. Repeat or manipulate only the named phone/IP/role/dealer/status/invitation/membership/client field in the disposable environment. Verify refusal/rate window and unchanged target state; do not attack a production system.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Membership manipulation cannot remove final OWNER.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-544 — ABUSE-010

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified attacker-like test identity; QA rate operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied request collection and relevant private bookmark. Record the initial visible state and fixture resource IDs.
2. Repeat or manipulate only the named phone/IP/role/dealer/status/invitation/membership/client field in the disposable environment. Verify refusal/rate window and unchanged target state; do not attack a production system.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Suspended dealer cannot regain functionality by changing client state.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-545 — ABUSE-011

Priority: P1. Agent result: PASS. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified attacker-like test identity; QA rate operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied request collection and relevant private bookmark. Record the initial visible state and fixture resource IDs.
2. Repeat or manipulate only the named phone/IP/role/dealer/status/invitation/membership/client field in the disposable environment. Verify refusal/rate window and unchanged target state; do not attack a production system.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Removed member cannot regain access using stale browser state.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-546 — ABUSE-012

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J013.

Setup: Specified attacker-like test identity; QA rate operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open QA-supplied request collection and relevant private bookmark. Record the initial visible state and fixture resource IDs.
2. Repeat or manipulate only the named phone/IP/role/dealer/status/invitation/membership/client field in the disposable environment. Verify refusal/rate window and unchanged target state; do not attack a production system.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Hidden UI routes remain server-protected.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-547 — GOLDEN-001

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: All named customer/dealer/Admin profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The exact ordered screens in the scenario. Record the initial visible state and fixture resource IDs.
2. Complete the entire arrow-separated journey in the specified order using the same fixture IDs. Use normal login, UI actions and all customer/dealer/Admin views; operator supplies final ownership/actor/audit checks. Do not combine unrelated partial passes.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Visitor → search → car → login/OTP → enquiry → dealer receives → STAFF contacts → MANAGER closes → Admin sees history.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-548 — GOLDEN-002

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: All named customer/dealer/Admin profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The exact ordered screens in the scenario. Record the initial visible state and fixture resource IDs.
2. Complete the entire arrow-separated journey in the specified order using the same fixture IDs. Use normal login, UI actions and all customer/dealer/Admin views; operator supplies final ownership/actor/audit checks. Do not combine unrelated partial passes.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Customer → save → logout → login → persistence → enquiry → history persists.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-549 — GOLDEN-003

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: All named customer/dealer/Admin profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The exact ordered screens in the scenario. Record the initial visible state and fixture resource IDs.
2. Complete the entire arrow-separated journey in the specified order using the same fixture IDs. Use normal login, UI actions and all customer/dealer/Admin views; operator supplies final ownership/actor/audit checks. Do not combine unrelated partial passes.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: New dealer → onboarding → documents → Admin approval → listing → moderation → ACTIVE → enquiry → SOLD → history preserved.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-550 — GOLDEN-004

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: All named customer/dealer/Admin profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The exact ordered screens in the scenario. Record the initial visible state and fixture resource IDs.
2. Complete the entire arrow-separated journey in the specified order using the same fixture IDs. Use normal login, UI actions and all customer/dealer/Admin views; operator supplies final ownership/actor/audit checks. Do not combine unrelated partial passes.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER → invite STAFF → existing customer accepts → dealer switch without re-login → draft → manager/owner submit → Admin approve.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-551 — GOLDEN-005

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: All named customer/dealer/Admin profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The exact ordered screens in the scenario. Record the initial visible state and fixture resource IDs.
2. Complete the entire arrow-separated journey in the specified order using the same fixture IDs. Use normal login, UI actions and all customer/dealer/Admin views; operator supplies final ownership/actor/audit checks. Do not combine unrelated partial passes.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER → invite MANAGER → customer-context switch → submit listing → enquiry management → SOLD.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-552 — GOLDEN-006

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: All named customer/dealer/Admin profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The exact ordered screens in the scenario. Record the initial visible state and fixture resource IDs.
2. Complete the entire arrow-separated journey in the specified order using the same fixture IDs. Use normal login, UI actions and all customer/dealer/Admin views; operator supplies final ownership/actor/audit checks. Do not combine unrelated partial passes.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: STAFF → draft → CONTACTED → privileged actions attempted → all denied.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-553 — GOLDEN-007

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: All named customer/dealer/Admin profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The exact ordered screens in the scenario. Record the initial visible state and fixture resource IDs.
2. Complete the entire arrow-separated journey in the specified order using the same fixture IDs. Use normal login, UI actions and all customer/dealer/Admin views; operator supplies final ownership/actor/audit checks. Do not combine unrelated partial passes.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: OWNER → revoke STAFF → open dealer session loses access → customer remains functional.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-554 — GOLDEN-008

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: All named customer/dealer/Admin profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The exact ordered screens in the scenario. Record the initial visible state and fixture resource IDs.
2. Complete the entire arrow-separated journey in the specified order using the same fixture IDs. Use normal login, UI actions and all customer/dealer/Admin views; operator supplies final ownership/actor/audit checks. Do not combine unrelated partial passes.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin → suspend dealer with ACTIVE inventory/enquiries → defined behavior → reinstate → appropriate restoration.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-555 — GOLDEN-009

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: HUMAN-UAT-J011.

Setup: All named customer/dealer/Admin profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The exact ordered screens in the scenario. Record the initial visible state and fixture resource IDs.
2. Complete the entire arrow-separated journey in the specified order using the same fixture IDs. Use normal login, UI actions and all customer/dealer/Admin views; operator supplies final ownership/actor/audit checks. Do not combine unrelated partial passes.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer member → personal customer context → enquiry with another dealer → employer/personal data remain isolated.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-556 — GOLDEN-010

Priority: P1. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: All named customer/dealer/Admin profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The exact ordered screens in the scenario. Record the initial visible state and fixture resource IDs.
2. Complete the entire arrow-separated journey in the specified order using the same fixture IDs. Use normal login, UI actions and all customer/dealer/Admin views; operator supplies final ownership/actor/audit checks. Do not combine unrelated partial passes.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Listing → ACTIVE → RESERVED → defined behavior → SOLD → public removal with history/audit preserved.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-001 — PUBLIC-001

Priority: P2. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open / and /cars. Record the initial visible state and fixture resource IDs.
2. Use homepage search, cars filters, a public car card and dealer directory. Use the fixture-sheet lifecycle variants; use browser refresh/back, and type an invalid route for not-found checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Anonymous user opens homepage and all public content loads without authentication.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-002 — PUBLIC-002

Priority: P2. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open / and /cars. Record the initial visible state and fixture resource IDs.
2. Use homepage search, cars filters, a public car card and dealer directory. Use the fixture-sheet lifecycle variants; use browser refresh/back, and type an invalid route for not-found checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Anonymous user searches from homepage and reaches `/cars` with correct search context.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-003 — PUBLIC-003

Priority: P2. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open / and /cars. Record the initial visible state and fixture resource IDs.
2. Use homepage search, cars filters, a public car card and dealer directory. Use the fixture-sheet lifecycle variants; use browser refresh/back, and type an invalid route for not-found checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Anonymous user browses `/cars` without authentication.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-004 — PUBLIC-004

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open / and /cars. Record the initial visible state and fixture resource IDs.
2. Use homepage search, cars filters, a public car card and dealer directory. Use the fixture-sheet lifecycle variants; use browser refresh/back, and type an invalid route for not-found checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Every supported car filter works individually.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-005 — PUBLIC-005

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open / and /cars. Record the initial visible state and fixture resource IDs.
2. Use homepage search, cars filters, a public car card and dealer directory. Use the fixture-sheet lifecycle variants; use browser refresh/back, and type an invalid route for not-found checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Multiple filters return correct intersection.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-006 — PUBLIC-006

Priority: P2. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open / and /cars. Record the initial visible state and fixture resource IDs.
2. Use homepage search, cars filters, a public car card and dealer directory. Use the fixture-sheet lifecycle variants; use browser refresh/back, and type an invalid route for not-found checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Individual filters can be cleared correctly.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-007 — PUBLIC-007

Priority: P2. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open / and /cars. Record the initial visible state and fixture resource IDs.
2. Use homepage search, cars filters, a public car card and dealer directory. Use the fixture-sheet lifecycle variants; use browser refresh/back, and type an invalid route for not-found checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Clear-all returns default results.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-008 — PUBLIC-008

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open / and /cars. Record the initial visible state and fixture resource IDs.
2. Use homepage search, cars filters, a public car card and dealer directory. Use the fixture-sheet lifecycle variants; use browser refresh/back, and type an invalid route for not-found checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: District changes correctly reset/update location-dependent filters/results.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-009 — PUBLIC-009

Priority: P2. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open / and /cars. Record the initial visible state and fixture resource IDs.
2. Use homepage search, cars filters, a public car card and dealer directory. Use the fixture-sheet lifecycle variants; use browser refresh/back, and type an invalid route for not-found checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: ACTIVE vehicle opens correct public portfolio.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-010 — PUBLIC-010

Priority: P2. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open / and /cars. Record the initial visible state and fixture resource IDs.
2. Use homepage search, cars filters, a public car card and dealer directory. Use the fixture-sheet lifecycle variants; use browser refresh/back, and type an invalid route for not-found checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: RESERVED vehicle interaction/navigation follows defined behavior.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-011 — PUBLIC-011

Priority: P2. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open / and /cars. Record the initial visible state and fixture resource IDs.
2. Use homepage search, cars filters, a public car card and dealer directory. Use the fixture-sheet lifecycle variants; use browser refresh/back, and type an invalid route for not-found checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: SOLD vehicle is absent from public search.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-012 — PUBLIC-012

Priority: P2. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open / and /cars. Record the initial visible state and fixture resource IDs.
2. Use homepage search, cars filters, a public car card and dealer directory. Use the fixture-sheet lifecycle variants; use browser refresh/back, and type an invalid route for not-found checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: WITHDRAWN vehicle is absent from public search.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-013 — PUBLIC-013

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open / and /cars. Record the initial visible state and fixture resource IDs.
2. Use homepage search, cars filters, a public car card and dealer directory. Use the fixture-sheet lifecycle variants; use browser refresh/back, and type an invalid route for not-found checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Moderation-pending listing is not publicly discoverable.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-014 — PUBLIC-014

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open / and /cars. Record the initial visible state and fixture resource IDs.
2. Use homepage search, cars filters, a public car card and dealer directory. Use the fixture-sheet lifecycle variants; use browser refresh/back, and type an invalid route for not-found checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Draft/rejected listing is not publicly discoverable.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-015 — PUBLIC-015

Priority: P2. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open / and /cars. Record the initial visible state and fixture resource IDs.
2. Use homepage search, cars filters, a public car card and dealer directory. Use the fixture-sheet lifecycle variants; use browser refresh/back, and type an invalid route for not-found checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Direct URL to non-public listing returns correct unavailable/not-found experience.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-016 — PUBLIC-016

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open / and /cars. Record the initial visible state and fixture resource IDs.
2. Use homepage search, cars filters, a public car card and dealer directory. Use the fixture-sheet lifecycle variants; use browser refresh/back, and type an invalid route for not-found checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Anonymous user can browse dealer directory.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-017 — PUBLIC-017

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open / and /cars. Record the initial visible state and fixture resource IDs.
2. Use homepage search, cars filters, a public car card and dealer directory. Use the fixture-sheet lifecycle variants; use browser refresh/back, and type an invalid route for not-found checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Active/verified dealer public portfolio opens correctly.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-018 — PUBLIC-018

Priority: P2. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open / and /cars. Record the initial visible state and fixture resource IDs.
2. Use homepage search, cars filters, a public car card and dealer directory. Use the fixture-sheet lifecycle variants; use browser refresh/back, and type an invalid route for not-found checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Public dealer listing count matches publicly available inventory.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-019 — PUBLIC-019

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open / and /cars. Record the initial visible state and fixture resource IDs.
2. Use homepage search, cars filters, a public car card and dealer directory. Use the fixture-sheet lifecycle variants; use browser refresh/back, and type an invalid route for not-found checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Pagination/infinite scroll does not duplicate or omit vehicles.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-020 — PUBLIC-020

Priority: P2. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open / and /cars. Record the initial visible state and fixture resource IDs.
2. Use homepage search, cars filters, a public car card and dealer directory. Use the fixture-sheet lifecycle variants; use browser refresh/back, and type an invalid route for not-found checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Refresh preserves intended search/filter state.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-021 — PUBLIC-021

Priority: P2. Agent result: FAIL. Bug: BUG-007. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open / and /cars. Record the initial visible state and fixture resource IDs.
2. Use homepage search, cars filters, a public car card and dealer directory. Use the fixture-sheet lifecycle variants; use browser refresh/back, and type an invalid route for not-found checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Invalid public route displays custom Dealers-Drive 404.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-022 — PUBLIC-022

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open / and /cars. Record the initial visible state and fixture resource IDs.
2. Use homepage search, cars filters, a public car card and dealer directory. Use the fixture-sheet lifecycle variants; use browser refresh/back, and type an invalid route for not-found checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: API/server failure displays application error UX rather than raw error.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-023 — PUBLIC-023

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open / and /cars. Record the initial visible state and fixture resource IDs.
2. Use homepage search, cars filters, a public car card and dealer directory. Use the fixture-sheet lifecycle variants; use browser refresh/back, and type an invalid route for not-found checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Public pages work on mobile/tablet/desktop.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-024 — PUBLIC-024

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open / and /cars. Record the initial visible state and fixture resource IDs.
2. Use homepage search, cars filters, a public car card and dealer directory. Use the fixture-sheet lifecycle variants; use browser refresh/back, and type an invalid route for not-found checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Public pages/API responses expose no private customer/dealer/Admin information.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-183 — MEDIA-001

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Admin media operator; visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/listings/{listingId} and /car/{publicSlug}. Record the initial visible state and fixture resource IDs.
2. Attach the exact QA StudioCar output to its intended vehicle, test the specified image ordering/count/replacement/error, then inspect the card and gallery arrows/fullscreen. Use the QA collection for foreign private media checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Vehicle data can exist before Dealers-Drive photography is attached.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-184 — MEDIA-002

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Admin media operator; visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/listings/{listingId} and /car/{publicSlug}. Record the initial visible state and fixture resource IDs.
2. Attach the exact QA StudioCar output to its intended vehicle, test the specified image ordering/count/replacement/error, then inspect the card and gallery arrows/fullscreen. Use the QA collection for foreign private media checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Correct StudioCar output links to correct listing.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-185 — MEDIA-003

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Admin media operator; visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/listings/{listingId} and /car/{publicSlug}. Record the initial visible state and fixture resource IDs.
2. Attach the exact QA StudioCar output to its intended vehicle, test the specified image ordering/count/replacement/error, then inspect the card and gallery arrows/fullscreen. Use the QA collection for foreign private media checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Intended maximum image count works.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-186 — MEDIA-004

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Admin media operator; visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/listings/{listingId} and /car/{publicSlug}. Record the initial visible state and fixture resource IDs.
2. Attach the exact QA StudioCar output to its intended vehicle, test the specified image ordering/count/replacement/error, then inspect the card and gallery arrows/fullscreen. Use the QA collection for foreign private media checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Image ordering works.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-187 — MEDIA-005

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Admin media operator; visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/listings/{listingId} and /car/{publicSlug}. Record the initial visible state and fixture resource IDs.
2. Attach the exact QA StudioCar output to its intended vehicle, test the specified image ordering/count/replacement/error, then inspect the card and gallery arrows/fullscreen. Use the QA collection for foreign private media checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Invalid media rejected.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-188 — MEDIA-006

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Admin media operator; visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/listings/{listingId} and /car/{publicSlug}. Record the initial visible state and fixture resource IDs.
2. Attach the exact QA StudioCar output to its intended vehicle, test the specified image ordering/count/replacement/error, then inspect the card and gallery arrows/fullscreen. Use the QA collection for foreign private media checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Replacement/removal does not create broken galleries.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-189 — MEDIA-007

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Admin media operator; visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/listings/{listingId} and /car/{publicSlug}. Record the initial visible state and fixture resource IDs.
2. Attach the exact QA StudioCar output to its intended vehicle, test the specified image ordering/count/replacement/error, then inspect the card and gallery arrows/fullscreen. Use the QA collection for foreign private media checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Failed upload does not corrupt listing.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-190 — MEDIA-008

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Admin media operator; visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/listings/{listingId} and /car/{publicSlug}. Record the initial visible state and fixture resource IDs.
2. Attach the exact QA StudioCar output to its intended vehicle, test the specified image ordering/count/replacement/error, then inspect the card and gallery arrows/fullscreen. Use the QA collection for foreign private media checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Public listing does not expose private/raw processing assets.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-191 — MEDIA-009

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Admin media operator; visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/listings/{listingId} and /car/{publicSlug}. Record the initial visible state and fixture resource IDs.
2. Attach the exact QA StudioCar output to its intended vehicle, test the specified image ordering/count/replacement/error, then inspect the card and gallery arrows/fullscreen. Use the QA collection for foreign private media checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Card uses correct primary image.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-192 — MEDIA-010

Priority: P2. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Admin media operator; visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/listings/{listingId} and /car/{publicSlug}. Record the initial visible state and fixture resource IDs.
2. Attach the exact QA StudioCar output to its intended vehicle, test the specified image ordering/count/replacement/error, then inspect the card and gallery arrows/fullscreen. Use the QA collection for foreign private media checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Gallery arrows work.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-193 — MEDIA-011

Priority: P2. Agent result: PASS. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Admin media operator; visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/listings/{listingId} and /car/{publicSlug}. Record the initial visible state and fixture resource IDs.
2. Attach the exact QA StudioCar output to its intended vehicle, test the specified image ordering/count/replacement/error, then inspect the card and gallery arrows/fullscreen. Use the QA collection for foreign private media checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Fullscreen gallery works.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-194 — MEDIA-012

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Admin media operator; visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/listings/{listingId} and /car/{publicSlug}. Record the initial visible state and fixture resource IDs.
2. Attach the exact QA StudioCar output to its intended vehicle, test the specified image ordering/count/replacement/error, then inspect the card and gallery arrows/fullscreen. Use the QA collection for foreign private media checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Missing image uses intended fallback.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-195 — MEDIA-013

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Admin media operator; visitor; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open /admin/listings/{listingId} and /car/{publicSlug}. Record the initial visible state and fixture resource IDs.
2. Attach the exact QA StudioCar output to its intended vehicle, test the specified image ordering/count/replacement/error, then inspect the card and gallery arrows/fullscreen. Use the QA collection for foreign private media checks.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Listing A cannot access/use Listing B media without authorization.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-438 — NOTIFY-001

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: New dealer applicant; Admin; QA mail operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Onboarding submission and isolated mail inbox. Record the initial visible state and fixture resource IDs.
2. Submit the fixture dealer application/state change. Operator records outbox/delivery IDs and received email, temporarily fails email delivery and restores/drains retries. Confirm one business outcome with intended delivery behavior and no assumed unimplemented notification.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Existing dealer-onboarding email works.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-439 — NOTIFY-002

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: New dealer applicant; Admin; QA mail operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Onboarding submission and isolated mail inbox. Record the initial visible state and fixture resource IDs.
2. Submit the fixture dealer application/state change. Operator records outbox/delivery IDs and received email, temporarily fails email delivery and restores/drains retries. Confirm one business outcome with intended delivery behavior and no assumed unimplemented notification.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Email outage does not corrupt onboarding.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-440 — NOTIFY-003

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: New dealer applicant; Admin; QA mail operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Onboarding submission and isolated mail inbox. Record the initial visible state and fixture resource IDs.
2. Submit the fixture dealer application/state change. Operator records outbox/delivery IDs and received email, temporarily fails email delivery and restores/drains retries. Confirm one business outcome with intended delivery behavior and no assumed unimplemented notification.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Retries do not cause destructive duplicate state.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-441 — NOTIFY-004

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: New dealer applicant; Admin; QA mail operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Onboarding submission and isolated mail inbox. Record the initial visible state and fixture resource IDs.
2. Submit the fixture dealer application/state change. Operator records outbox/delivery IDs and received email, temporarily fails email delivery and restores/drains retries. Confirm one business outcome with intended delivery behavior and no assumed unimplemented notification.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Missing email configuration follows intended non-production behavior.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-442 — NOTIFY-005

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: New dealer applicant; Admin; QA mail operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Onboarding submission and isolated mail inbox. Record the initial visible state and fixture resource IDs.
2. Submit the fixture dealer application/state change. Operator records outbox/delivery IDs and received email, temporarily fails email delivery and restores/drains retries. Confirm one business outcome with intended delivery behavior and no assumed unimplemented notification.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Unimplemented listing/enquiry/complaint notifications are not assumed by business logic.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-466 — BROWSER-001

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Specified real browser/device; all relevant profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Search → car → save/enquire → dealer/Admin critical views. Record the initial visible state and fixture resource IDs.
2. Use the actual named browser/OS/device. Complete the critical journeys, show its soft keyboard in forms, exercise dialogs/back/forward/new tabs and inspect overflow/actions. Record unavailable engine/device as not verified.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Chrome desktop works.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-467 — BROWSER-002

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Specified real browser/device; all relevant profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Search → car → save/enquire → dealer/Admin critical views. Record the initial visible state and fixture resource IDs.
2. Use the actual named browser/OS/device. Complete the critical journeys, show its soft keyboard in forms, exercise dialogs/back/forward/new tabs and inspect overflow/actions. Record unavailable engine/device as not verified.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Safari desktop works.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-468 — BROWSER-003

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Specified real browser/device; all relevant profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Search → car → save/enquire → dealer/Admin critical views. Record the initial visible state and fixture resource IDs.
2. Use the actual named browser/OS/device. Complete the critical journeys, show its soft keyboard in forms, exercise dialogs/back/forward/new tabs and inspect overflow/actions. Record unavailable engine/device as not verified.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Firefox desktop works.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-469 — BROWSER-004

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Specified real browser/device; all relevant profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Search → car → save/enquire → dealer/Admin critical views. Record the initial visible state and fixture resource IDs.
2. Use the actual named browser/OS/device. Complete the critical journeys, show its soft keyboard in forms, exercise dialogs/back/forward/new tabs and inspect overflow/actions. Record unavailable engine/device as not verified.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Edge desktop works.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-470 — BROWSER-005

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Specified real browser/device; all relevant profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Search → car → save/enquire → dealer/Admin critical views. Record the initial visible state and fixture resource IDs.
2. Use the actual named browser/OS/device. Complete the critical journeys, show its soft keyboard in forms, exercise dialogs/back/forward/new tabs and inspect overflow/actions. Record unavailable engine/device as not verified.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Chrome Android/mobile works.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-471 — BROWSER-006

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Specified real browser/device; all relevant profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Search → car → save/enquire → dealer/Admin critical views. Record the initial visible state and fixture resource IDs.
2. Use the actual named browser/OS/device. Complete the critical journeys, show its soft keyboard in forms, exercise dialogs/back/forward/new tabs and inspect overflow/actions. Record unavailable engine/device as not verified.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Safari iPhone/mobile works.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-472 — BROWSER-007

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Specified real browser/device; all relevant profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Search → car → save/enquire → dealer/Admin critical views. Record the initial visible state and fixture resource IDs.
2. Use the actual named browser/OS/device. Complete the critical journeys, show its soft keyboard in forms, exercise dialogs/back/forward/new tabs and inspect overflow/actions. Record unavailable engine/device as not verified.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Tablet works.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-473 — BROWSER-008

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Specified real browser/device; all relevant profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Search → car → save/enquire → dealer/Admin critical views. Record the initial visible state and fixture resource IDs.
2. Use the actual named browser/OS/device. Complete the critical journeys, show its soft keyboard in forms, exercise dialogs/back/forward/new tabs and inspect overflow/actions. Record unavailable engine/device as not verified.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer dashboard usable mobile.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-474 — BROWSER-009

Priority: P2. Agent result: FAIL. Bug: BUG-008. Journey: use the specific ticket procedure below.

Setup: Specified real browser/device; all relevant profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Search → car → save/enquire → dealer/Admin critical views. Record the initial visible state and fixture resource IDs.
2. Use the actual named browser/OS/device. Complete the critical journeys, show its soft keyboard in forms, exercise dialogs/back/forward/new tabs and inspect overflow/actions. Record unavailable engine/device as not verified.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin dashboard usable at supported responsive sizes.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-475 — BROWSER-010

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Specified real browser/device; all relevant profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Search → car → save/enquire → dealer/Admin critical views. Record the initial visible state and fixture resource IDs.
2. Use the actual named browser/OS/device. Complete the critical journeys, show its soft keyboard in forms, exercise dialogs/back/forward/new tabs and inspect overflow/actions. Record unavailable engine/device as not verified.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dialogs usable with mobile keyboard.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-476 — BROWSER-011

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Specified real browser/device; all relevant profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Search → car → save/enquire → dealer/Admin critical views. Record the initial visible state and fixture resource IDs.
2. Use the actual named browser/OS/device. Complete the critical journeys, show its soft keyboard in forms, exercise dialogs/back/forward/new tabs and inspect overflow/actions. Record unavailable engine/device as not verified.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Browser back/forward preserves valid state.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-477 — BROWSER-012

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Specified real browser/device; all relevant profiles; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Search → car → save/enquire → dealer/Admin critical views. Record the initial visible state and fixture resource IDs.
2. Use the actual named browser/OS/device. Complete the critical journeys, show its soft keyboard in forms, exercise dialogs/back/forward/new tabs and inspect overflow/actions. Record unavailable engine/device as not verified.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: New tabs do not break session/context.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-478 — UX-001

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Keyboard/screen-reader operator; relevant customer/dealer/Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The stated form/dialog/list screen. Record the initial visible state and fixture resource IDs.
2. Use Tab/Shift-Tab/Enter/Escape without a pointer, read the field/button name with the screen reader, trigger empty/error/loading/destructive state as specified, and verify focus, labels, next action and confirmation visually and by keyboard.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Public search keyboard accessible.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-479 — UX-002

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Keyboard/screen-reader operator; relevant customer/dealer/Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The stated form/dialog/list screen. Record the initial visible state and fixture resource IDs.
2. Use Tab/Shift-Tab/Enter/Escape without a pointer, read the field/button name with the screen reader, trigger empty/error/loading/destructive state as specified, and verify focus, labels, next action and confirmation visually and by keyboard.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Authentication keyboard accessible.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-480 — UX-003

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Keyboard/screen-reader operator; relevant customer/dealer/Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The stated form/dialog/list screen. Record the initial visible state and fixture resource IDs.
2. Use Tab/Shift-Tab/Enter/Escape without a pointer, read the field/button name with the screen reader, trigger empty/error/loading/destructive state as specified, and verify focus, labels, next action and confirmation visually and by keyboard.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer forms keyboard accessible.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-481 — UX-004

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Keyboard/screen-reader operator; relevant customer/dealer/Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The stated form/dialog/list screen. Record the initial visible state and fixture resource IDs.
2. Use Tab/Shift-Tab/Enter/Escape without a pointer, read the field/button name with the screen reader, trigger empty/error/loading/destructive state as specified, and verify focus, labels, next action and confirmation visually and by keyboard.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Admin forms keyboard accessible.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-482 — UX-005

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Keyboard/screen-reader operator; relevant customer/dealer/Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The stated form/dialog/list screen. Record the initial visible state and fixture resource IDs.
2. Use Tab/Shift-Tab/Enter/Escape without a pointer, read the field/button name with the screen reader, trigger empty/error/loading/destructive state as specified, and verify focus, labels, next action and confirmation visually and by keyboard.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Fields have meaningful labels.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-483 — UX-006

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Keyboard/screen-reader operator; relevant customer/dealer/Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The stated form/dialog/list screen. Record the initial visible state and fixture resource IDs.
2. Use Tab/Shift-Tab/Enter/Escape without a pointer, read the field/button name with the screen reader, trigger empty/error/loading/destructive state as specified, and verify focus, labels, next action and confirmation visually and by keyboard.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Validation identifies affected field.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-484 — UX-007

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Keyboard/screen-reader operator; relevant customer/dealer/Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The stated form/dialog/list screen. Record the initial visible state and fixture resource IDs.
2. Use Tab/Shift-Tab/Enter/Escape without a pointer, read the field/button name with the screen reader, trigger empty/error/loading/destructive state as specified, and verify focus, labels, next action and confirmation visually and by keyboard.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dialog focus handled correctly.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-485 — UX-008

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Keyboard/screen-reader operator; relevant customer/dealer/Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The stated form/dialog/list screen. Record the initial visible state and fixture resource IDs.
2. Use Tab/Shift-Tab/Enter/Escape without a pointer, read the field/button name with the screen reader, trigger empty/error/loading/destructive state as specified, and verify focus, labels, next action and confirmation visually and by keyboard.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Buttons have understandable accessible names.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-486 — UX-009

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Keyboard/screen-reader operator; relevant customer/dealer/Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The stated form/dialog/list screen. Record the initial visible state and fixture resource IDs.
2. Use Tab/Shift-Tab/Enter/Escape without a pointer, read the field/button name with the screen reader, trigger empty/error/loading/destructive state as specified, and verify focus, labels, next action and confirmation visually and by keyboard.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Loading states prevent accidental repeated actions.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-487 — UX-010

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Keyboard/screen-reader operator; relevant customer/dealer/Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The stated form/dialog/list screen. Record the initial visible state and fixture resource IDs.
2. Use Tab/Shift-Tab/Enter/Escape without a pointer, read the field/button name with the screen reader, trigger empty/error/loading/destructive state as specified, and verify focus, labels, next action and confirmation visually and by keyboard.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Empty states explain next action.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-488 — UX-011

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Keyboard/screen-reader operator; relevant customer/dealer/Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The stated form/dialog/list screen. Record the initial visible state and fixture resource IDs.
2. Use Tab/Shift-Tab/Enter/Escape without a pointer, read the field/button name with the screen reader, trigger empty/error/loading/destructive state as specified, and verify focus, labels, next action and confirmation visually and by keyboard.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Destructive actions have appropriate confirmation.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-489 — UX-012

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Keyboard/screen-reader operator; relevant customer/dealer/Admin; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open The stated form/dialog/list screen. Record the initial visible state and fixture resource IDs.
2. Use Tab/Shift-Tab/Enter/Escape without a pointer, read the field/button name with the screen reader, trigger empty/error/loading/destructive state as specified, and verify focus, labels, next action and confirmation visually and by keyboard.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Permission denied does not appear as application crash.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-490 — SEO-001

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; QA deployment operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Public route plus robots.txt/sitemap.xml. Record the initial visible state and fixture resource IDs.
2. Open the specified public fixture/status route, compare title/canonical/description/social/structured data and indexing inclusion to the approved deployed origin sheet; request invalid route or controlled server failure for error experience.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Homepage canonical/meta/structured data correct.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-491 — SEO-002

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; QA deployment operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Public route plus robots.txt/sitemap.xml. Record the initial visible state and fixture resource IDs.
2. Open the specified public fixture/status route, compare title/canonical/description/social/structured data and indexing inclusion to the approved deployed origin sheet; request invalid route or controlled server failure for error experience.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: `/cars` indexing behavior correct.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-492 — SEO-003

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; QA deployment operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Public route plus robots.txt/sitemap.xml. Record the initial visible state and fixture resource IDs.
2. Open the specified public fixture/status route, compare title/canonical/description/social/structured data and indexing inclusion to the approved deployed origin sheet; request invalid route or controlled server failure for error experience.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Public car portfolio metadata/structured data correct.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-493 — SEO-004

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; QA deployment operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Public route plus robots.txt/sitemap.xml. Record the initial visible state and fixture resource IDs.
2. Open the specified public fixture/status route, compare title/canonical/description/social/structured data and indexing inclusion to the approved deployed origin sheet; request invalid route or controlled server failure for error experience.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Dealer portfolio metadata correct.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-494 — SEO-005

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; QA deployment operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Public route plus robots.txt/sitemap.xml. Record the initial visible state and fixture resource IDs.
2. Open the specified public fixture/status route, compare title/canonical/description/social/structured data and indexing inclusion to the approved deployed origin sheet; request invalid route or controlled server failure for error experience.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Sitemap includes only intended public resources.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-495 — SEO-006

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; QA deployment operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Public route plus robots.txt/sitemap.xml. Record the initial visible state and fixture resource IDs.
2. Open the specified public fixture/status route, compare title/canonical/description/social/structured data and indexing inclusion to the approved deployed origin sheet; request invalid route or controlled server failure for error experience.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: SOLD/WITHDRAWN/private resources handled correctly for indexing.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-496 — SEO-007

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; QA deployment operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Public route plus robots.txt/sitemap.xml. Record the initial visible state and fixture resource IDs.
2. Open the specified public fixture/status route, compare title/canonical/description/social/structured data and indexing inclusion to the approved deployed origin sheet; request invalid route or controlled server failure for error experience.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: robots.txt correct.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-497 — SEO-008

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; QA deployment operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Public route plus robots.txt/sitemap.xml. Record the initial visible state and fixture resource IDs.
2. Open the specified public fixture/status route, compare title/canonical/description/social/structured data and indexing inclusion to the approved deployed origin sheet; request invalid route or controlled server failure for error experience.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Favicon/social metadata work.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-498 — SEO-009

Priority: P2. Agent result: FAIL. Bug: BUG-007. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; QA deployment operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Public route plus robots.txt/sitemap.xml. Record the initial visible state and fixture resource IDs.
2. Open the specified public fixture/status route, compare title/canonical/description/social/structured data and indexing inclusion to the approved deployed origin sheet; request invalid route or controlled server failure for error experience.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Invalid URLs use custom 404.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________

### HUMAN-UAT-499 — SEO-010

Priority: P2. Agent result: BLOCKED. Bug: none confirmed. Journey: use the specific ticket procedure below.

Setup: Anonymous visitor; QA deployment operator; use the private fixture sheet with exactly the lifecycle/identity state in the expected condition below. Obtain any required failure/race/provider fixture from QA before starting.

Steps:

1. In the specified isolated profile open Public route plus robots.txt/sitemap.xml. Record the initial visible state and fixture resource IDs.
2. Open the specified public fixture/status route, compare title/canonical/description/social/structured data and indexing inclusion to the approved deployed origin sheet; request invalid route or controlled server failure for error experience.
3. Check the complete expected condition below, including the negative request or related history/ownership where named. Record the actual result and screenshot; ask QA for the matching DB/audit evidence for server-only requirements.
4. Restore/reset only the disposable fixture before the next test. Do not mark PASS if a prerequisite or required observation is unavailable.

Expected: Server failures use custom error experience.

Human result: **PENDING**. [ ] PASS [ ] FAIL. Notes / evidence / timestamp / browser: ____________________
