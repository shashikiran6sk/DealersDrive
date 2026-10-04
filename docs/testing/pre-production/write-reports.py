"""Render the baseline dossier from reviewed evidence, without changing the app."""
import collections
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SHA = 'd6ae115359c4d0ae7ab0fd5115336291666cbb08'
rows = json.loads((ROOT / 'registry.json').read_text())
counts = collections.Counter(r['status'] for r in rows)
STAMP = '2026-10-02 (Asia/Calcutta, UTC+05:30)'
COMMON = f'Baseline `{SHA}` · {STAMP}. Local isolated pre-production simulation; no production connection or application fix.\n\n'
def write(name, title, body):
    (ROOT / name).write_text(f'# {title}\n\n{COMMON}{body.strip()}\n')

bugs = [
dict(id='BUG-001', severity='P2', title='Invitation acceptance versus withdrawal returns an unhandled database conflict', tests=['ADD-RACE-001'], preconditions='An ACTIVE dealership owner has invited a verified customer as STAFF; invitation is PENDING.', steps=['Run the repository integration scenario dealer-tenancy-hardening.test.ts / races / never lets an accept outrun a withdrawal into a membership.', 'Send invitation acceptance as the invited customer and DELETE of that invitation as OWNER concurrently.', 'Inspect both HTTP responses and the invitation/membership state.'], expected='If acceptance wins, the losing withdrawal returns the defined 404; if withdrawal wins, acceptance is refused and no membership appears.', actual='Acceptance returned 200, but withdrawal returned 500 instead of 404. Prisma reported a write conflict/deadlock in the withdrawal transaction. The suite failed its HTTP assertion.', evidence=['evidence/ci/tests.log', 'evidence/ci/api-assertions.json'], impact='Unreliable owner revocation UX and a failed race gate. This failure alone does not prove unauthorized membership creation.', reproducibility='Observed once in the full fresh baseline suite; timing dependent. The suite was not rerun until green.'),
dict(id='BUG-002', severity='P1', title='Admin approval activates an incomplete DRAFT dealership', tests=['VERIFY-011'], preconditions='Authorized Admin; a DRAFT dealership has three document rows in REQUIRED state, with no uploaded verification documents.', steps=['Create a fresh DRAFT dealer through onboarding in the isolated fixture.', 'As Admin, POST /v1/admin/dealers/{dealerId}/approve with an empty JSON body.', 'Read the authoritative dealer status and document checklist.'], expected='Refuse approval and retain a non-ACTIVE state until submission and verification requirements are satisfied.', actual='HTTP 200; DRAFT became ACTIVE while all three documents remained REQUIRED.', evidence=['evidence/security/api-probes.json'], impact='Server approval bypasses the intended dealer verification gate. Authorized Admins can activate an unverified dealer via direct API.', reproducibility='One direct HTTP reproduction with DB state, SEC-DISC-001 and its observed row.'),
dict(id='BUG-003', severity='P2', title='Timestamp-only cursors omit equal-time saved cars and enquiries', tests=['DATA-DISC-001', 'DATA-DISC-002', 'DATA-DISC-003'], preconditions='At least three records in the same customer saved/enquiry collection or dealer enquiry inbox have exactly the same createdAt timestamp. This is possible at DB timestamp precision and was forced in the local fixture.', steps=['Use the safe isolated fixture to assign the same createdAt to three existing records.', 'GET /v1/enquiries?limit=1, /v1/saved-vehicles?limit=1 or /v1/dealer/enquiries?limit=1 with the appropriate session.', 'Follow page.nextCursor with limit=1 and compare all visited IDs with the authoritative DB rows.'], expected='Every record appears once, including ties, with a stable secondary key.', actual='First page contained one row and hasMore=true; the next page contained zero rows while additional equal-time records existed. Reproduced on all three collections.', evidence=['evidence/security/api-probes.json', 'evidence/security/followup-probes.json'], impact='Customers and dealership users can miss historical records. No data was deleted. Admin enquiry pagination has a tested ID tie-breaker and did not show this defect.', reproducibility='Three isolated API/DB reproductions across the affected surfaces.'),
dict(id='BUG-004', severity='P2', title='Known vehicle media remains public after dealership suspension', tests=['SEC-DISC-002'], preconditions='ACTIVE dealer B has a published listing and a known derived public image URL.', steps=['Fetch the listing page/API and its /media/by-media/{mediaId}/{width}.webp URL.', 'Suspend dealer B through the authorized Admin endpoint.', 'Fetch the same listing and image URLs again; inspect status and then reinstate the isolated dealer.'], expected='If suspension removes the listing from public access, public media authorization applies the same dealer visibility rule.', actual='Listing returned 404 while its known image URL returned 200 during suspension.', evidence=['evidence/security/followup-probes.json'], impact='Previously public vehicle photography remains retrievable while the listing is hidden. This probe did not disclose KYC documents or private originals.', reproducibility='One direct same-URL before/after suspension reproduction.'),
dict(id='BUG-005', severity='P1', title='A blocked listing mutation commits after membership revocation', tests=['CONCURRENCY-007', 'CROSS-019'], preconditions='An ACTIVE MANAGER has a complete DRAFT listing. A separate local DB connection holds the listing row FOR UPDATE.', steps=['Start MANAGER POST /v1/dealer/vehicles/{vehicleId}/submit and prove it is waiting on the held listing lock using a separate observer connection.', 'As OWNER, DELETE /v1/dealer/team/members/{membershipId}; confirm 204 and REMOVED.', 'Release the listing lock, await the pending response, and inspect listing/member state.', 'Make another protected request using the same manager session.'], expected='After revocation commits, the pending mutation is rejected and the listing remains DRAFT, as required by the campaign’s revocation-before-operation rule.', actual='Revocation committed, then submission returned 200 and changed the listing to PENDING_REVIEW. The next dealer request returned 401.', evidence=['evidence/concurrency/revocation-in-flight.json'], impact='Membership is checked before the blocking transaction and is not revalidated at commit. A revoked actor can complete an in-flight privileged write. It did not publish an ACTIVE listing.', reproducibility='One controlled and observed lock-order reproduction. An earlier observer-snapshot harness mistake was preserved as BLOCKED and corrected before this reproduction.'),
dict(id='BUG-006', severity='P1', title='Production configuration accepts the MinIO adapter', tests=['PROD-002'], preconditions='Complete generated inert production configuration; no real provider credentials; no provider/network calls.', steps=['Run config-probes.py, which imports the existing env validator in isolated subprocesses.', 'Use NODE_ENV=production, APP_ENV=production and STORAGE_DRIVER=minio with otherwise valid generated configuration.', 'Observe boot validation exit status.'], expected='Production refuses MinIO under the user’s explicit production configuration requirement.', actual='Validator exited 0 and accepted MinIO. The same probe confirmed rejection of fake OTP, SMTP/Mailpit, dev auth, local disk, memory cache and console mail.', evidence=['evidence/security/config-probes.json'], impact='A configuration mistake can select the forbidden storage adapter at production boot. This demonstrates a guard failure; no deployed storage was contacted.', reproducibility='One isolated validator reproduction, CONFIG-002.'),
dict(id='BUG-007', severity='P2', title='Invalid routes display the default unbranded Next.js 404', tests=['PUBLIC-021', 'SEO-009'], preconditions='Built unchanged web app at localhost; desktop, tablet or mobile Chromium viewport.', steps=['Navigate to /a-route-that-does-not-exist.', 'Inspect HTTP status, visible text and screenshot at 1440, 768 and 390-pixel widths.'], expected='A custom Dealers-Drive not-found experience.', actual='HTTP 404 with only the local environment ribbon and “404 / This page could not be found.” The Dealers-Drive brand/navigation is absent.', evidence=['evidence/targeted-browser.json', 'evidence/desktop/not-found.png', 'evidence/tablet/not-found.png', 'evidence/mobile/not-found.png'], impact='Invalid public links leave users on a generic dead end. The HTTP status itself is correct.', reproducibility='Same visible result at all three viewport sizes.'),
dict(id='BUG-008', severity='P2', title='Admin pages overflow the mobile viewport', tests=['BROWSER-009'], preconditions='Authorized Admin fixture at 390×844 Chromium viewport; Admin uses responsive layouts.', steps=['Open /admin/dealers, /admin/listings and /admin/enquiries.', 'Compare document.documentElement.scrollWidth with innerWidth.', 'Inspect the right edge, table and navigation in the captured screenshots.'], expected='Supported responsive Admin pages remain within the viewport with deliberate contained scrolling for wide tables.', actual='All three views measured scrollWidth 423 at width 390. The enquiry table and tabs are clipped in the mobile screenshot.', evidence=['evidence/targeted-browser.json', 'evidence/admin/final-browser.json', 'evidence/admin/enquiries.png'], impact='Admin mobile actions and columns require horizontal page scrolling or become hard to discover. Browser rendering is available, but responsive usability fails.', reproducibility='Three views plus an independent repeat measurement of the enquiry view.'),
dict(id='BUG-009', severity='P2', title='Dependency audit reports unresolved high-severity advisories', tests=['ADD-AUDIT-001'], preconditions='Unchanged lockfile on the baseline commit and access to the package advisory service.', steps=['Run pnpm audit --audit-level=critical and preserve the result.', 'Run pnpm audit --json to retain advisory details without changing dependencies.', 'Assess installed paths and production reachability before a future dependency fix.'], expected='Launch dependency risks are understood and triaged against deployed paths.', actual='24 advisories: 9 high, 12 moderate, 3 low, no critical. The critical threshold exits 0; the default audit exits 1. High advisories include PostCSS, deepmerge-ts, mysql2, undici and brace-expansion.', evidence=['evidence/ci/dependency-audit.log', 'evidence/ci/dependency-advisories.json'], impact='Known dependency risks remain untriaged. Advisory presence is confirmed; exploitation and production reachability are not established. P2 is provisional pending that assessment.', reproducibility='Two registry audit queries against the unchanged lockfile.'),
]
for b in bugs: b.update(status='OPEN', commit=SHA, environment='Isolated local Linux / Node 24.19.0 / pnpm 9.15.9 / PostgreSQL 16.14 / Chromium 151', fix_pr=None, retest='NOT_RUN')
(ROOT / 'bugs.json').write_text(json.dumps(bugs, indent=2) + '\n')
body = 'No fixes were made. P0: 0; P1: 3; P2: 6. All nine bugs are OPEN; dependency severity is provisional.\n\n'
for b in bugs:
    body += f"## {b['id']} — {b['title']}\n\nSeverity: **{b['severity']}**. Tests: {', '.join(b['tests'])}. Status: OPEN. Fix PR: none. Retest: NOT_RUN.\n\nCommit: `{SHA}`. Environment: {b['environment']}.\n\nPreconditions: {b['preconditions']}\n\nSteps:\n\n"
    body += '\n'.join(f'{i}. {s}' for i, s in enumerate(b['steps'], 1)) + '\n\n'
    body += f"Expected: {b['expected']}\n\nActual: {b['actual']}\n\nSecurity/data impact: {b['impact']}\n\nReproducibility: {b['reproducibility']}\n\nEvidence: " + ', '.join(f'[{p}]({p})' for p in b['evidence']) + '.\n\n'
write('BUG-REPORT.md', 'Baseline bugs — no fixes', body)

additional = []
for path in ['evidence/security/api-probes.json', 'evidence/security/followup-probes.json', 'evidence/security/config-probes.json']:
    for p in json.loads((ROOT / path).read_text()):
        if not p.get('canonical') and p['status'] in ['PASS', 'FAIL']:
            bug = 'BUG-003' if p['id'].startswith('DATA-DISC') else 'BUG-004' if p['id'] == 'SEC-DISC-002' else None
            additional.append({'id': p['id'], 'status': p['status'], 'scenario': p.get('title'), 'evidence': [{'path': path, 'selector': {'probe': p['id']}}], 'bugs': [bug] if bug else [], 'sha': SHA, 'fix_pr': None, 'retest': 'NOT_RUN'})
additional += [dict(id='ADD-RACE-001', status='FAIL', scenario=bugs[0]['title'], evidence=[{'path': 'evidence/ci/api-assertions.json', 'selector': {'file':'apps/api/tests/dealer-tenancy-hardening.test.ts','assertion':'races never lets an accept outrun a withdrawal into a membership'}}], bugs=['BUG-001'], sha=SHA, fix_pr=None, retest='NOT_RUN'), dict(id='ADD-AUDIT-001', status='FAIL', scenario=bugs[-1]['title'], evidence=[{'path':'evidence/ci/dependency-advisories.json','selector':'advisories'}], bugs=['BUG-009'], sha=SHA, fix_pr=None, retest='NOT_RUN')]
(ROOT / 'additional-tests.json').write_text(json.dumps(additional, indent=2) + '\n')

write('TEST-RESULTS.md', 'Baseline execution results', f'''
Decision: **NO GO**. The baseline campaign is documented, but launch certification is incomplete.

| Canonical outcome | Count |
| --- | ---: |
| PASS | {counts['PASS']} |
| FAIL | {counts['FAIL']} |
| BLOCKED | {counts['BLOCKED']} |
| NOT_APPLICABLE | 0 |
| Total accounted | 556 |
| Missing / duplicated / unclassified | 0 / 0 / 0 |

PASS means the exact scenario has reviewed execution evidence within its recorded local method. It does not certify live providers, all browser brands, every layer, or human approval. Individual assertion names, probe IDs, layer results and limitations are in [registry.json](registry.json) and [TEST-COVERAGE-MATRIX.md](TEST-COVERAGE-MATRIX.md). BLOCKED is a launch gap, not a pass. No unsupported behavior was silently declared NOT_APPLICABLE.

| Repository check | Result | Evidence |
| --- | --- | --- |
| Prisma client generation | PASS | TEST-PLAN.md; generated with Prisma 7.10 |
| Fresh typecheck | PASS; 6 tasks, 0 cached | evidence/ci/typecheck.log |
| Fresh lint/format/docs checks | PASS after dossier generation; 6 tasks, 0 cached | evidence/ci/final-lint.log |
| Full unit/integration/contracts suite | **FAIL**, 4,289 passed / 4,290 assertions | evidence/ci/tests.log |
| API | 2,585 passed / 2,586; one invitation race failed | evidence/ci/api-assertions.json |
| Web | 1,284 passed / 1,284 | evidence/ci/web-assertions.json |
| Contracts | 420 passed / 420 | evidence/ci/contracts-assertions.json |
| Fresh production build | PASS; 3 tasks, 0 cached | evidence/ci/build.log |
| Fresh PostgreSQL migrations | PASS; all 39 applied | evidence/ci/migrate.log |
| Prisma schema validation | PASS | evidence/ci/prisma-validate.log |
| Dependency audit | No critical; 9 high / 12 moderate / 3 low remain | evidence/ci/dependency-advisories.json |
| Terraform fmt/validate | BLOCKED; CLI unavailable | TEST-PLAN.md |
| Repository browser E2E script | Not present; direct Chromium UAT performed | AGENT-UAT.md |
| API coverage gate | BLOCKED; failed suite did not produce verified fresh coverage | evidence/ci/tests.log |

Harness corrections were limited to test tooling: Turbo argument forwarding, generated-document formatting, actual mark-sold route/204 semantics, keyset observer snapshot clearing, hydration waits and Playwright selectors. Original browser attempts and blocked race evidence were retained. A cached typecheck was replaced by a fresh run. The application race failure was never rerun until green.

Additional discoveries are separately registered in [additional-tests.json](additional-tests.json); they do not inflate the 556 denominator. [BUG-REPORT.md](BUG-REPORT.md) contains all confirmed failures. All 556 human results remain PENDING.
''')

write('LIFECYCLE-MATRIX.md', 'Lifecycle rules and tested boundaries', '''
| Entity | Intended transitions and consequences | Baseline evidence / gaps |
| --- | --- | --- |
| Dealer | DRAFT → PENDING_APPROVAL → ACTIVE; changes-requested remediation; suspension → reinstatement; rejection purges the application; CLOSED terminal | Suspension/reinstatement and fresh membership checks passed locally. **BUG-002:** approve API accepts incomplete DRAFT. Full browser onboarding/remediation and production policy remain blocked. |
| Listing | DRAFT → PENDING_REVIEW → ACTIVE; CHANGES_REQUESTED → edit/resubmit; REJECTED final; ACTIVE → RESERVED or SOLD or WITHDRAWN; RESERVED → SOLD; RESERVED/WITHDRAWN reactivation requires Admin review | Individual DB-backed lifecycle and moderation assertions passed; in-flight revoked submission fails **BUG-005**. |
| Public visibility | ACTIVE and RESERVED appear; available counts ACTIVE only; dealer must be ACTIVE; SOLD/WITHDRAWN/non-public rows hidden | public-lifecycle assertions verify state filters and counts. Suspended image delivery is inconsistent (**BUG-004**). Broad end-to-end count synchronization remains blocked where not directly measured. |
| Saved car | Human/customer owned; preserved through terminal listing states; reserved/sold/unavailable labels | saved-vehicles lifecycle assertions pass. Equal-time pagination loses results (**BUG-003**). Full logout/login persistence browser run blocked by local rate limit. |
| Enquiry | NEW → CONTACTED / CLOSED / SPAM according to permission; first contact actor/time preserved; close actor/time recorded; history remains | Mobile NEW→CONTACTED→CLOSED passed; authoritative actor/time fields exist. Individual SOLD history checks passed. Every suspension/removal interaction is not yet covered. |
| Membership | ACTIVE OWNER/MANAGER/STAFF; OWNER changes MANAGER↔STAFF or removes; removed row retained and reactivated only via a new invitation | Immediate next-request denial and personal-data preservation passed. Last OWNER guarded. Revocation during blocked write fails **BUG-005**. |
| Invitation | PENDING → ACCEPTED / DECLINED / REVOKED / EXPIRED; invitation identifies a verified phone | Replay, identity, expiry and concurrent acceptance assertions pass; acceptance vs withdrawal produced 500 (**BUG-001**). |

Evidence: [API assertions](evidence/ci/api-assertions.json), [direct probes](evidence/security/api-probes.json), [revocation race](evidence/concurrency/revocation-in-flight.json), [mobile journey](evidence/golden-browser.json), [DB snapshot](evidence/concurrency/final-database-snapshot.json). Exact canonical status takes precedence over this architecture summary.
''')
write('RBAC-MATRIX.md', 'Dealership and Admin permissions', '''
| Capability | OWNER | MANAGER | STAFF | Ordinary customer |
| --- | --- | --- | --- | --- |
| Dealer dashboard/inventory | Allow | Allow | Allow | Deny without membership |
| Prepare/edit permitted draft | Allow | Allow | Allow | Deny |
| Submit / reserve / sell / withdraw | Allow | Allow | Deny | Deny |
| Read dealer enquiry contact information | Allow | Allow | Allow | Own personal enquiries only |
| NEW → CONTACTED | Allow | Allow | Allow | Deny dealer mutation |
| Close / SPAM / privileged enquiry transitions | Allow | Allow | Deny | Deny |
| Protected profile/KYC changes | Allow | Deny | Deny | Deny |
| Team invitations/role changes/removal | Allow; final OWNER protected | Deny | Deny | Deny |
| Admin API | Deny | Deny | Deny | Deny |
| Personal saved/enquiry actions | Human scoped | Human scoped | Human scoped | Human scoped |

Admin SUPPORT, MODERATOR and SUPER_ADMIN permissions are separate from dealer roles and require an active scoped Admin session/seat. Table describes intended architecture; granular executed results are in the registry. Direct STAFF submit/reserve/mark-sold/withdraw tests returned 403, cross-role Team APIs denied, and owner-only profile/document tests passed. Changing client state cannot supply a different dealer or role. A role is re-read on the next request; commit-time revocation safety failed BUG-005.

Evidence: dealer-roles, dealer-team and dealer-tenancy-hardening exact assertions in [api-assertions.json](evidence/ci/api-assertions.json); [follow-up probes](evidence/security/followup-probes.json). Admin live Google sign-in remains blocked.
''')
write('IDENTITY-MATRIX.md', 'Human identity and workspace separation', '''
| Identity/context operation | Observed | Limit |
| --- | --- | --- |
| Phone customer signup and repeat signin | One human identity; normal desktop UI signup passed locally | Fake OTP driver; live MSG91/SMS not certified |
| Phone plus Google linking | Integration tests converge to one account and refuse collisions | Google provider replaced with fake claims |
| Customer scope → dealer workspace | Real STAFF customer API login adds no session; OWNER/MANAGER/STAFF mobile UI workspace switch succeeds | OWNER/MANAGER browser fixture sessions were issued for setup; not proof of normal real login |
| Dealer person → personal collection | Human/customer ID supplies Saved Cars and My Enquiries | Full competitor-data golden journey not entirely exercised in browser |
| Membership removed | Dealer requests 401, personal requests 200; saved/enquiry/draft rows survive | In-flight write can still commit, BUG-005 |
| Dealer suspended | Dealer denied; personal customer capabilities preserved | Every multi-dealer fallback and browser-tab interaction not exhausted |
| Admin identity | ADMIN scope plus active authorization; person scopes rejected | Browser fixture authenticates setup only; real Google flow blocked |

User phone is unique; OAuth identity is keyed by provider/subject; sessions store hashes, scope, expiry and revocation. Multiple memberships resolve through membership-owned workspace choices. These are source architecture findings, with supporting executed assertions recorded individually; source inspection is not PASS.

Evidence: [unified-session/identity-linking assertions](evidence/ci/api-assertions.json), [personal-access probes](evidence/security/followup-probes.json), [workspace/browser measurements](evidence/targeted-browser.json).
''')
write('API-SECURITY.md', 'API authorization and validation evidence', '''
Anonymous requests to dealer vehicles/team/enquiries, Admin dealers/enquiries and customer saved/enquiries returned 401. A customer with no membership returned 401 on dealer APIs. STAFF privileged listing routes returned 403; MANAGER/STAFF Team invitation routes returned 403; all tested non-admin account types returned 401 from Admin aggregation.

Foreign-tenant vehicle read/edit/delete returned the same 404 as an unknown ID and left the row unchanged. Malformed UUID returned 400. Privileged extra fields were rejected rather than assigned. Separate integration assertions cover enquiry tenant isolation, invitation identity/replay, protected profile/document permissions and final-owner protection.

Open security findings: incomplete dealer approval (BUG-002), member mutation after removal commits (BUG-005), production MinIO acceptance (BUG-006), and post-suspension public media consistency (BUG-004). Production cookie/CORS/CSRF behavior, complete error leakage, deployed rate limiting and real OAuth/OTP provider behavior remain BLOCKED unless an exact registry case says otherwise. The local widget bucket’s exhaustion is expected limit behavior, not a production availability defect.

Evidence: [probes](evidence/security/api-probes.json), [actual-route follow-up](evidence/security/followup-probes.json), [config validator](evidence/security/config-probes.json), [revocation race](evidence/concurrency/revocation-in-flight.json). No tokens, private signed URLs or provider credentials are in this evidence bundle.
''')
write('TENANT-ISOLATION.md', 'Tenant and customer isolation', '''
Vehicle/draft/enquiry/team ID-taking routes were exercised across OWNER, MANAGER and STAFF in the integration suite. Foreign rows produce 404 and remain unchanged. Direct probes repeated vehicle GET/PATCH/DELETE versus a missing UUID. Requests cannot choose dealerId or customerId through additional fields. Enquiry customer and dealer derive from the authenticated person and listing.

Personal saved/enquiry collections remain keyed by user, independent of employer membership. Removing STAFF preserved a competitor saved car and personal enquiry, denied dealer operations, and retained the staff-created dealership draft. The complete employer/competitor browser golden path and every private storage boundary remain blocked.

Evidence: dealer-tenancy-hardening / dealer-roles / enquiries / saved-vehicles exact assertions in [api-assertions.json](evidence/ci/api-assertions.json), API-PROBE-006/008/012/013 and API-FOLLOWUP-001. BUG-005 is temporal authorization leakage within a former tenant, not an observed cross-tenant read.
''')
write('DATA-INTEGRITY.md', 'Authoritative database observations', '''
The final isolated DB snapshot had 11 users, 3 dealers, 5 memberships, 9 vehicles/listings, 8 enquiries, 9 saved records and 136 audit rows. These counts include intentionally retained bug fixtures and are not launch seed data. No orphan enquiry/listing references or unvalidated foreign keys were found in the inspected relationships.

The mobile browser enquiry ended CLOSED with both contactedAt/closedAt and contactedById/closedById present. STAFF saw its individual contact attribution; MANAGER saw close attribution. Admin history showed the three transitions with actor category “Dealer”; the initial harness’s extra expectation of individual names in Admin UI was not an established requirement and is classified BLOCKED. The database retains individual actors.

Revocation probes retained the draft, its dealership and creator, personal saved and enquiry records; suspension/reinstatement preserved measured rows. Individual lifecycle/migration assertions preserve SOLD enquiry history and old owner/profile/doc/session relationships. This is not a comprehensive production restore or all-table integrity certification.

BUG-003 omits records during pagination but does not delete them. BUG-002 intentionally left an incomplete dealer ACTIVE as reproduction evidence; BUG-005 intentionally left the blocked draft PENDING_REVIEW before the removed manager rejoined through a real invitation.

Evidence: [aggregate DB snapshot](evidence/concurrency/final-database-snapshot.json), [API probes](evidence/security/api-probes.json), [revocation follow-up](evidence/security/followup-probes.json), [migration assertions](evidence/ci/api-assertions.json).
''')
write('CONCURRENCY.md', 'Race outcomes and launch gates', '''
| Race | Executed result | Evidence |
| --- | --- | --- |
| Five identical customer enquiries | One 201, four 409; one stored lead | API-PROBE-010 |
| Five identical saves | One stored saved record | API-PROBE-011 |
| Two invitation accepts | One membership | dealer-team exact assertions |
| Reserve vs sell; sell vs withdraw | One valid winning lifecycle state | dealer-listing-lifecycle / dealer-tenancy-hardening assertions |
| Admin approve vs reject | One decision and one audit outcome | listing-approval / moderation-decisions assertions |
| Concurrent enquiry status updates | Serialized valid transition | dealer-enquiries / tenancy-hardening assertions |
| Invitation accept vs withdrawal | **FAIL**, losing withdrawal HTTP 500 | BUG-001; full baseline suite |
| Member removal before blocked submit commits | **FAIL**, removed actor commits PENDING_REVIEW | BUG-005; lock wait proved by independent observer |

The first revocation observer reused a transaction snapshot and could not prove the wait; that attempt remains BLOCKED in followup-probes.json. The corrected probe used an independent observer, observed a real Lock wait, committed removal, then released the row lock. This was a harness correction, not an application fix. Two-staff editing, suspension-vs-submit, review-vs-edit and other unmapped races remain BLOCKED. A suite-wide green rerun was not used to hide the invitation failure.

Evidence: [race trace](evidence/concurrency/revocation-in-flight.json), [API outcomes](evidence/security/api-probes.json), [assertion records](evidence/ci/api-assertions.json).
''')
write('FAILURE-RECOVERY.md', 'Recovery evidence and unexecuted failures', '''
Complete API, DB, storage, OTP, Google and mail outage injection was not performed through the browser. Production restart/drain, ambiguous network timeout retries, backup restore and failed migration rollback are BLOCKED. Adapter and UI failure tests passed in the repository suite but are not a substitute for these full recovery scenarios.

Exercised recovery interactions: filter refresh/back/forward; gallery close/reopen/Escape; OWNER invite cancellation/reopen; persisted STAFF draft refresh; customer history refresh after closure. Browser original-attempt logs and later harness limitations remain in evidence. Shared local sign-in bucket exhaustion blocked repeated login; no rate-limit setting was disabled to manufacture successful authentication.

Infrastructure setup failures were contained: Docker registry pull hit rate limits, so an isolated bundled PostgreSQL 16 binary was used; the first Turbo reporter invocation was rejected before tests; an Admin fixture helper initially lacked the allowlist env and was corrected before browser setup completed. These are test-environment incidents, not product recovery certification.

Evidence: [browser attempts](evidence/desktop/uat.json), [mobile journey](evidence/golden-browser.json), [suite CLI attempt](evidence/ci/tests-cli-attempt.json), TEST-PLAN.md. Real provider and production recovery verification is required before launch.
''')
write('BROWSER-COMPATIBILITY.md', 'Browser coverage limits', '''
| Browser/device | Status | Actual scope |
| --- | --- | --- |
| System Chromium 151, Linux | Partial PASS | Real headless browser, clicking/typing/navigation/scrolling; desktop 1440×900, tablet 768×1024, mobile 390×844 |
| Branded Chrome desktop / Android | BLOCKED | Chromium engine evidence is useful; installed branded browser/real Android not available |
| Safari desktop / iPhone / WebKit | BLOCKED | Engine and real devices unavailable |
| Firefox | BLOCKED | Browser binary unavailable |
| Edge | BLOCKED | Browser binary unavailable |
| Tablet device / mobile soft keyboard | BLOCKED | Viewport/touch emulation; no OS keyboard overlap or real tablet certificate |
| Admin responsive width | FAIL | 423-pixel document at 390-pixel viewport, BUG-008 |

Successful Chromium interactions are not a blanket BROWSER-001/005/007 PASS. No Chrome/Safari/Firefox claim is inferred from rendered HTML. Full golden paths and multi-tab context remain incomplete; see each canonical row.

Evidence: [desktop](evidence/desktop/uat.json), [tablet](evidence/tablet/uat.json), [mobile](evidence/mobile/uat.json), [role UI](evidence/targeted-browser.json), [mobile enquiry chain](evidence/golden-browser.json).
''')
write('RESPONSIVE-QA.md', 'Responsive interaction review', '''
Public /cars, car detail, Saved Cars, My Enquiries and dealer directory had scrollWidth equal to viewport width at 1440, 768 and 390 pixels. Search, filters, gallery arrows/fullscreen, and history navigation were exercised. Mobile customer enquiry submission/history, STAFF contact, MANAGER close and persisted STAFF draft were exercised by clicks and typing; OWNER Team invite dialog opened, cancelled and reopened.

Mobile OWNER/MANAGER/STAFF dashboard, inventory and enquiry pages measured 390-pixel document width. Captured screenshots were visually reviewed for labels, cards, fixed navigation and clipping. Solid-color fixture JPEGs are deliberate synthetic images, not a photography-quality test.

Admin dealers/listings/enquiries overflowed to 423 pixels and the enquiry columns/tabs are clipped (**BUG-008**). No assertion of complete Admin mobile usability is made. Real keyboard overlap, landscape, all modal focus traps, long international labels and sticky collision edge cases remain BLOCKED.

Evidence: [width measurements](evidence/targeted-browser.json), [public viewport widths](evidence/mobile/uat.json), [Team screenshot](evidence/dealer-owner/team-cancel-reopen.png), [Admin overflow](evidence/admin/enquiries.png), [mobile draft](evidence/dealer-staff/mobile-draft-persisted.png).
''')
write('ACCESSIBILITY-QA.md', 'Accessibility observations and gaps', '''
Keyboard Enter submitted public search. Gallery Close and Escape worked after reopen. Selectors used visible field labels, meaningful button names, heading/form association and account-menu names. Mobile enquiry identity and Verified text were visible. STAFF close controls were absent; the server separately denied privileged transitions. OWNER invite had a labelled dialog and cancellation controls.

These are observations, not a WCAG or screen-reader certificate. No complete automated accessibility scan, contrast audit, focus-order/trap audit, screen-reader run, keyboard-only Admin/dealer form traversal or real mobile keyboard test was completed. UX canonical cases remain BLOCKED unless explicitly mapped to a reviewed execution. Root-level page error listeners in the initial Chromium UAT recorded no unhandled page errors, but do not establish all recovery/error boundaries.

Evidence: [browser action logs](evidence/desktop/uat.json), [targeted UI](evidence/targeted-browser.json), [mobile golden chain](evidence/golden-browser.json). The generic 404 fails custom experience requirements (BUG-007).
''')
http = json.loads((ROOT / 'evidence/public/local-http-observations.json').read_text())['samples']
write('SEO-QA.md', 'Local SEO smoke and production gaps', '''
Local homepage, /cars, public car and /dealers returned 200 with a title, description, canonical and two JSON-LD blocks. The canonical origin is localhost because the inspected deployment is local. robots.txt disallows all indexing in this environment; local sitemap behavior is recorded. Neither behavior is declared a production defect or launch PASS.

The API sitemap lifecycle integration tests exclude SOLD/WITHDRAWN, include ACTIVE/RESERVED, drop suspended dealers and expose only slug/date information. These support the underlying resource policy, while deployed origin, robots, social images, structured-data validity and indexing changes remain BLOCKED.

Invalid route returned HTTP 404 with default Next.js text, without Dealers-Drive branding (**BUG-007**, PUBLIC-021/SEO-009). Server failure custom experience was not injected.

Evidence: [local HTTP/meta observations](evidence/public/local-http-observations.json), [404 screenshots](evidence/desktop/not-found.png), exact public-lifecycle assertions in [api-assertions.json](evidence/ci/api-assertions.json).
''')
write('PRODUCTION-CONFIG-QA.md', 'Production configuration baseline', '''
| Guard probe | Observed |
| --- | --- |
| Complete generated inert production fixture | Accepted; proves validator fixture is valid, not that production resources are correct |
| MinIO | **Accepted — FAIL, BUG-006** |
| Fake/dummy OTP | Rejected — PASS for guard |
| SMTP/Mailpit adapter | Rejected — PASS for guard |
| Development auth / local disk / memory cache / console mail | Rejected |

No real credentials were printed or used. Config probes imported the unchanged env validator only; they made no provider requests. The production DB, R2/S3 object policies, OAuth redirect domains, MSG91/WhatsApp delivery, Resend sender, deployed docs/metrics/internal endpoints and bundle secret analysis are not certified.

Source-only concern requiring a future isolated reproduction: generic db:seed has no visible production guard, and dev seed’s explicit ALLOW_REMOTE_DEV_SEED override returns before its production guard. This is not registered as a confirmed bug or PASS; PROD-005/DEPLOY-007 remain BLOCKED. Do not invoke either against production to investigate.

Local .env audit found APP_ENV local, development mode, local DB/storage, fake OTP and console mail; runtime jobs/inline worker/docs/metrics were disabled for exploratory isolation. Production can only be checked after an intended environment and authorized credentials are supplied.

Evidence: [config probe outcomes](evidence/security/config-probes.json), [audit environment](evidence/environment.json), TEST-PLAN.md. Terraform was unavailable, and backups were not restored.
''')
perf = '| Path | HTTP | Six local samples: middle sample / maximum (ms) |\n| --- | --- | --- |\n' + '\n'.join(f"| `{p['path']}` | {p['http']} | {p['median_ms']} / {p['max_ms']} |" for p in http)
write('PERFORMANCE-SMOKE.md', 'Loopback performance smoke', f'''
Built web app, one process, tiny synthetic DB, six sequential requests per public route, including response body consumption. All sampled endpoints returned 200. Results are HTTP smoke timings, not browser LCP/INP/CLS, provider latency, production throughput or a load-test/SLA result.

{perf}

Evidence: [samples](evidence/public/local-http-observations.json). Cold starts, concurrency saturation, production-size data/index plans, CDN caching and remote storage remain untested. The timings do not contribute blanket canonical PASS.
''')
write('AGENT-UAT.md', 'Actual browser journeys and evidence', '''
Actual Chromium interaction was used: typing search and phone fields, pressing Enter, clicking filters and cards, gallery arrows/fullscreen, closing/reopening/Escape, scrolling to the footer, back/forward, refresh, account menus and viewport changes. This was not URL-only status checking.

| Journey | Outcome / scope | Evidence |
| --- | --- | --- |
| Anonymous homepage → search → cars | PASS in desktop/tablet/mobile engine | evidence/{desktop,tablet,mobile}/uat.json |
| Filter → refresh → clear → browser history | PASS in all three sizes | same records |
| Gallery arrows → fullscreen → close → reopen → Escape | PASS in all three sizes | car-gallery.png and UAT-003 |
| New customer login → account Saved/My Enquiries | PASS local desktop signup; subsequent repeated signins blocked by shared widget allowance | desktop UAT-004; later blocked rows preserved |
| Save → remove → save | PASS through real mobile buttons | JOURNEY-customer |
| Enquiry prefill → cancel/reopen → send → history | PASS mobile/tablet with existing authenticated state; fresh mobile lead chain passed | targeted-browser.json / golden-browser.json |
| Customer lead → STAFF contact → MANAGER close → customer CLOSED | PASS mobile UI; DB confirms both individual actors/times | golden-browser.json; final-database-snapshot.json |
| Admin search → open same enquiry → history | Reviewed transition chain present | admin/golden-enquiry-history.png and ADMIN-BROWSER-chain |
| OWNER/MANAGER/STAFF personal menu → dealer dashboard/inventory/enquiries | PASS mobile with customer-scope setup fixtures | targeted-browser.json |
| OWNER invite dialog cancel/reopen | PASS mobile; no invitation created by this UI case | dealer-owner/team-cancel-reopen.png |
| STAFF partial draft save → refresh | PASS mobile | dealer-staff/mobile-draft-persisted.png |
| Dealer directory → portfolio | Portfolio screenshot captured; combined 404 check blocked, so full combined journey not marked PASS | dealer-portfolio.png; UAT-007 |
| Invalid public route | FAIL branded experience at all sizes | BUG-007 |
| Admin mobile sizing | FAIL; 423 > 390 | BUG-008 |

Screenshots reviewed included the public homepage/car detail, mobile enquiry history, Team, staff contact/draft, manager closure and Admin enquiry detail/list. Admin detail correctly shows category “Dealer” for audit entries; the first extra expectation of individual names there was not a defined requirement and was reclassified BLOCKED, with initial evidence retained. DB and dealer UI retain the individuals.

Browser fixture authentication uses actual session issuance for setup and fake Google/OTP only in isolated tests. It does not certify real OAuth, SMS or production cookies. Earlier selector/navigation timing mistakes are preserved under original-attempt; corrections changed harness logic only. Desktop state was logged out during the blocked persistence attempt and was not falsely treated as logged in afterward.

Human results are entirely PENDING. Real mobile keyboards, Safari/Firefox/Edge/Android, outage recovery and complete GOLDEN-001 through GOLDEN-010 remain outstanding. [HUMAN-UAT.md](HUMAN-UAT.md) supplies independent verification instructions.
''')
write('RETEST-REPORT.md', 'Retest status', '''
No application fix, fix commit, fix PR, merge, or deployment was performed. Every confirmed bug remains OPEN and every fix retest is NOT_RUN. Baseline SHA and final workspace HEAD are identical. No repeated-green suite result supersedes the failed baseline.

Harness follow-ups are documented separately from fix retests: actual mark-sold route and DELETE 204 semantics; independent lock observer; valid allowlist setup; hydration waits and locator disambiguation. Original blocked attempts were retained. These improve evidence accuracy and do not close any product bug.

A later authorized fix phase must give each BUG-### a regression test, concrete fix diff/PR, targeted retest, neighboring lifecycle/role/tenant checks and required CI. Recompute all 556 classifications, provider/browser gaps and human results on the new exact SHA. The current NO GO stays in force.
''')
write('FINAL-CERTIFICATION.md', 'Final baseline decision — NO GO', f'''
**NO GO.** Baseline assessment is complete as a dossier; launch certification is blocked by three OPEN P1 defects, the failed repository suite, {counts['BLOCKED']} unverified canonical scenarios and pending independent human verification.

Tested exact `origin/main` SHA: `{SHA}`. Branch: `test/pre-production-baseline-d6ae115`. All runtime tests and browser observations used this unchanged application. Only certification documentation, harnesses and synthetic local data were added; no fixes, commits, PRs, merges or production writes were performed.

| Required accounting | Result |
| --- | ---: |
| Expected / parsed / accounted | 556 / 556 / 556 |
| PASS | {counts['PASS']} |
| FAIL | {counts['FAIL']} |
| BLOCKED | {counts['BLOCKED']} |
| NOT_APPLICABLE | 0 |
| Missing / duplicate / unclassified | 0 / 0 / 0 |
| Human results PENDING | 556 |

The supplied headings understated ENQ-CREATE by one and ADMIN-DEALER by one. The preserved numbered scenarios include ENQ-CREATE-018 and ADMIN-DEALER-010; none was dropped. [Completeness evidence](evidence/final-counts.json) and [registry validation](evidence/registry-validation.json) preserve this correction.

OPEN P1 blockers:

1. **BUG-002:** incomplete DRAFT dealership becomes ACTIVE through Admin approval API.
2. **BUG-005:** revoked manager’s blocked submission commits after removal.
3. **BUG-006:** production validator accepts MinIO despite the explicit production requirement.

OPEN P2 findings: invitation race HTTP 500, omitted timestamp-tied saved/enquiry records, publicly available images after suspension, unbranded 404, Admin mobile overflow, and untriaged dependency advisories. P0: 0. Total bugs: 9; P1: 3; P2: 6. [BUG-REPORT.md](BUG-REPORT.md) gives reproducible steps and evidence.

Fresh typecheck, build, lint and all 39 migrations passed. The full test command **failed**: API 2,585/2,586, web 1,284/1,284, contracts 420/420; total 4,289 passed and one failed assertion. Fresh API coverage was not verified. Direct DB-backed probes and actual mobile/desktop/tablet Chromium journeys supplemented the suite, including mobile enquiry contact/closure with authoritative actor/timestamp checks.

Outstanding release checks include real Google/MSG91/email/object storage, intended production DB/origins/cookies, other browser engines and real devices/keyboards, comprehensive outage recovery, production backup restore/deployment/Terraform, all blocked exact canonical scenarios and every independent human sign-off. Local performance and successful mocked-provider assertions are limited evidence; no success percentage is used as a release decision.

Proceed to [HUMAN-UAT.md](HUMAN-UAT.md) only in an authorized isolated environment with accessible URL and disposable fixtures. Product owner results remain PENDING. Fix proposals require a separate authorized fix phase; the baseline stops here without changing application behavior.

Review entry points: [test results](TEST-RESULTS.md), [556-row registry](CANONICAL-TEST-REGISTRY.md), [layer/evidence matrix](TEST-COVERAGE-MATRIX.md), [bug report](BUG-REPORT.md), [browser UAT](AGENT-UAT.md), [retest status](RETEST-REPORT.md).
''')
names = ['CANONICAL-TEST-REGISTRY.md','TEST-PLAN.md','TEST-RESULTS.md','TEST-COVERAGE-MATRIX.md','LIFECYCLE-MATRIX.md','RBAC-MATRIX.md','IDENTITY-MATRIX.md','API-SECURITY.md','TENANT-ISOLATION.md','DATA-INTEGRITY.md','CONCURRENCY.md','FAILURE-RECOVERY.md','BROWSER-COMPATIBILITY.md','RESPONSIVE-QA.md','ACCESSIBILITY-QA.md','SEO-QA.md','PRODUCTION-CONFIG-QA.md','PERFORMANCE-SMOKE.md','AGENT-UAT.md','HUMAN-UAT.md','BUG-REPORT.md','RETEST-REPORT.md','FINAL-CERTIFICATION.md']
write('README.md','Pre-production baseline dossier', '**Decision: NO GO.** Read [FINAL-CERTIFICATION.md](FINAL-CERTIFICATION.md) and [BUG-REPORT.md](BUG-REPORT.md) first.\n\n' + '\n'.join(f'- [{n}]({n})' for n in names) + '''

Machine records: registry.json, bugs.json, additional-tests.json, evidence/final-counts.json and verify-dossier.py. Run `python3 docs/testing/pre-production/verify-dossier.py` from the repository root. Each canonical scenario has a status, method, reason, evidence/limitation, bug link if failed, no fix PR, NOT_RUN retest and PENDING human result.

Harness scripts are optional replay tools for disposable isolated databases; they mutate synthetic fixtures and are not idempotent general production utilities. Never replay them against shared/production resources. Private session fixtures and browser storage state remain outside this directory under /tmp; do not commit or share them. Evidence images show fictional accounts/numbers and deliberately synthetic JPEGs. Logs are sanitized.

Status semantics: PASS is scoped executed behavior; FAIL is a confirmed deviation; BLOCKED is missing execution, unavailable environment/provider or unestablished product expectation; NOT_APPLICABLE is reserved for proven inapplicability and unused here. Empty evidence directory READMEs are placeholders, never PASS. Original harness mistakes are preserved, not product failures. No source fix or repeat-until-green suite run occurred.
''')
print('Wrote baseline dossier and nine OPEN bug records.')
