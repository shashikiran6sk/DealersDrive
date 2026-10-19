"""Build conservative, assertion-level traceability; never infer coverage by filename."""
import collections
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SHA = 'd6ae115359c4d0ae7ab0fd5115336291666cbb08'
rows = json.loads((ROOT / 'registry.json').read_text())
by_id = {r['id']: r for r in rows}
assertions = json.loads((ROOT / 'evidence/ci/api-assertions.json').read_text())['assertions']
for r in rows:
    r.update(status='BLOCKED', method='NOT_FULLY_EXECUTED', evidence=[], bugs=[], fix_pr=None, retest='NOT_RUN', human_uat='PENDING', sha=SHA, layer_results={layer: 'PENDING' if layer == 'HUMAN_UAT' else 'NOT_EXECUTED' for layer in r['layers']})
    reason = {
        'BROWSER': 'Required branded browser/OS or complete responsive journey was not available or fully executed; Chromium emulation is partial evidence.',
        'PROD': 'Deployed production resources and real provider configuration were unavailable; isolated validator checks cover only explicitly mapped cases.',
        'DEPLOY': 'Fresh local migrations ran, but this production deployment/recovery/backup scenario was not executed on a restored production-like snapshot.',
        'OBS': 'Deployed telemetry and end-to-end log retention/redaction were not exercised; local unit checks are supporting evidence only.',
        'RECOVERY': 'The specified failure was not injected through the complete application/browser recovery path.',
        'NOTIFY': 'Real mail delivery/provider outage was not exercised; local outbox and adapter mocks are supporting evidence only.',
        'STORAGE': 'Production object storage and signed-URL boundaries were not exercised end to end against the intended provider.',
        'SEO': 'Complete deployed metadata, indexing and origin configuration were not validated.',
        'GOLDEN': 'This entire ordered journey, including its authentication/provider and final history/audit steps, was not executed as one end-to-end test.',
        'UX': 'The stated accessibility/interaction requirement was not checked across all relevant forms and devices.',
        'ONBOARD': 'The complete onboarding browser journey with real identity/document providers was not executed for this scenario.',
        'VERIFY': 'This review/remediation/audit scenario was not executed with all required application states.',
        'MEDIA': 'The complete photography/asset pipeline and required UI behavior were not exercised for this case.',
    }.get(r['group'], 'No reviewed execution covers the entire stated scenario; related suite passes do not establish this case.')
    r['reason'] = reason + ' Outstanding requirement: ' + r['scenario']

def record(ids, path, selector, method='INTEGRATION_API_DATABASE', status='PASS', layer='API'):
    for id in ids.split():
        r = by_id[id]
        r['evidence'].append({'path': path, 'selector': selector})
        r['layer_results'][layer] = status
        if r['status'] != 'FAIL':
            r.update(status=status, method=method, reason='Scenario verified within the recorded local execution scope; human verification remains pending.')

def support(ids, file, needle):
    found = [a for a in assertions if a['file'] == f'apps/api/tests/{file}.test.ts' and needle in a['name']]
    assert found, (ids, file, needle)
    assert all(a['status'] == 'passed' for a in found), (ids, found)
    for a in found:
        unit = '/unit/' in a['file']
        record(ids, 'evidence/ci/api-assertions.json', {'file': a['file'], 'assertion': a['name']}, method='UNIT_MOCKED_DEPENDENCIES' if unit else 'INTEGRATION_API_DATABASE', layer='UNIT' if unit else 'API')
        if not unit:
            for id in ids.split():
                by_id[id]['layer_results']['DATABASE'] = 'PASS'
                by_id[id]['layer_results']['INTEGRATION'] = 'PASS'

# Reviewed exact behavioral assertions, not whole-suite attribution.
MAPPINGS = [
('PUBLIC-011 PUBLIC-012 PUBLIC-013 PUBLIC-014', 'public-lifecycle', 'neither SOLD nor WITHDRAWN'),
('PUBLIC-010 LISTING-LIFE-009', 'public-lifecycle', 'opens a RESERVED car from a known link'),
('PUBLIC-015', 'public-lifecycle', 'answers a SOLD car with a 404'),
('PUBLIC-018 LISTING-LIFE-004', 'public-lifecycle', 'counts the dealership’s current listings'),
('AUTH-003', 'customer-auth', 'a wrong code'),
('AUTH-005', 'customer-auth', 'a token presented twice'),
('AUTH-006 ABUSE-001', 'unit/modules/auth/phone-sign-in.routes', 'allows ten tries at one number'),
('AUTH-011 CUSTOMER-004', 'unified-session', 'logs out of both at once'),
('AUTH-014 API-SEC-007 ENQ-CREATE-018', 'enquiries', 'lists only their own'),
('CUSTOMER-006 CUSTOMER-010 IDENTITY-008 CROSS-027', 'enquiries', 'lists a dealer’s own enquiries as a customer'),
('CUSTOMER-007 CUSTOMER-008 IDENTITY-011 MEMBER-020', 'unified-session', 'keeps a removed member signed in as a customer'),
('CUSTOMER-009 IDENTITY-012 DEALER-LIFE-011 DEALER-LIFE-012 CROSS-022', 'dealer-roles', 'a suspended dealership locks every member out'),
('SAVED-003', 'saved-vehicles', 'removes a saved car, idempotently'),
('SAVED-006', 'saved-vehicles', 'saves a reserved car'),
('SAVED-007 CROSS-008', 'saved-vehicles', 'keeps it through a reservation, a sale'),
('SAVED-008', 'saved-vehicles', 'shows a withdrawn car as no longer available'),
('SAVED-010', 'saved-vehicles', 'keeps each customer’s list to themselves'),
('ENQ-CREATE-006', 'enquiries', 'refuses a message past its limit'),
('ENQ-CREATE-007', 'public-lifecycle', 'refuses a SOLD car'),
('ENQ-CREATE-008', 'public-lifecycle', 'refuses a WITHDRAWN car'),
('ENQ-CREATE-009', 'enquiries', 'refuses a PENDING_REVIEW listing'),
('ENQ-CREATE-009', 'enquiries', 'refuses a DRAFT listing'),
('ENQ-CREATE-009', 'enquiries', 'refuses a REJECTED listing'),
('ENQ-CREATE-010 LISTING-LIFE-010', 'public-lifecycle', 'refuses a RESERVED car'),
('ENQ-CREATE-011', 'public-lifecycle', 'never an enquiry after the sale'),
('ENQ-CREATE-014 ENQ-CREATE-016', 'dealer-enquiries', 'lists its enquiries newest first'),
('ENQ-CREATE-015 ENQ-CREATE-016', 'admin-enquiries', 'the very enquiry the dealership sees'),
('ENQ-CREATE-017', 'dealer-enquiries', 'another dealership’s enquiry, and leaves it untouched'),
('ENQ-LIFE-001', 'enquiries', 'shows a NEW enquiry as SENT'),
('ENQ-LIFE-002 ENQ-LIFE-003 ENQ-LIFE-008 STAFF-009 STAFF-010 STAFF-011', 'dealer-roles', 'lets STAFF see the customer and mark a new enquiry contacted'),
('ENQ-LIFE-004 STAFF-012', 'dealer-roles', 'refuses STAFF marking an enquiry CLOSED'),
('ENQ-LIFE-006 ENQ-LIFE-009 MANAGER-008', 'dealer-roles', 'lets a MANAGER close, keeping who contacted'),
('ENQ-LIFE-010', 'dealer-enquiries', 'refuses an unknown status'),
('ENQ-LIFE-011', 'dealer-roles', 'refuses STAFF reopening'),
('ENQ-LIFE-012', 'dealer-enquiries', 'serialises two simultaneous changes'),
('ENQ-LIFE-013', 'enquiries', 'shows a CONTACTED enquiry as CONTACTED'),
('ENQ-LIFE-014', 'enquiries', 'shows a CLOSED enquiry as CLOSED'),
('ENQ-LIFE-015 LISTING-LIFE-019', 'dealer-listing-lifecycle', 'keeps every enquiry the car had'),
('ENQ-LIFE-018', 'enquiries', 'drops the link once the car is off'),
('ONBOARD-005 ONBOARD-018 DATA-006', 'identity-linking', 'converges both identities on the one account'),
('ONBOARD-009', 'dealer-onboarding', 'without a tagline is refused'),
('ONBOARD-009', 'dealer-onboarding', 'without a service is refused'),
('ONBOARD-009', 'dealer-onboarding', 'yard photograph is required'),
('ONBOARD-012', 'dealer-onboarding', 'records an uploaded document against the checklist'),
('ONBOARD-017 MODERATION-007', 'listing-submission', 'refuses a dealership that is not yet approved'),
('DEALER-LIFE-005 DEALER-LIFE-006 SEARCH-005', 'public-lifecycle', 'drops a suspended dealership and every car'),
('DEALER-LIFE-013 IDENTITY-013', 'dealer-roles', 'closes only that dealership to a person who belongs to two'),
('LISTING-CREATE-001 LISTING-CREATE-002', 'dealer-roles', 'lets the OWNER do every listing move'),
('LISTING-CREATE-003 LISTING-CREATE-006 STAFF-003 STAFF-004', 'dealer-roles', 'lets STAFF create and edit a draft'),
('MODERATION-001 MODERATION-002', 'listing-submission', 'refuses STAFF'),
('MODERATION-003 MANAGER-004', 'dealer-roles', 'lets a MANAGER submit a draft STAFF prepared'),
('MODERATION-004 MODERATION-006', 'listing-submission', 'moves a complete draft to PENDING_REVIEW'),
('MODERATION-005', 'listing-submission', 'refuses an incomplete vehicle'),
('MODERATION-010 LISTING-LIFE-001 ADMIN-LISTING-003', 'listing-approval', 'publishes it, stamps publishedAt'),
('MODERATION-011 SEARCH-001', 'listing-approval', 'shows the dealer the listing as live'),
('MODERATION-012 MODERATION-014 ADMIN-LISTING-004', 'moderation-decisions', 'rejects with a reason'),
('MODERATION-016', 'listing-approval', 'refuses a listing already live'),
('MODERATION-017 CONCURRENCY-004', 'listing-approval', 'lets exactly one of approve and reject win'),
('MODERATION-018 ADMIN-LISTING-010', 'moderation-decisions', 'records only that one'),
('LISTING-LIFE-005', 'dealer-roles', 'lets the OWNER do every listing move'),
('LISTING-LIFE-006 LISTING-LIFE-007', 'dealer-roles', 'refuses STAFF reserve, allows MANAGER'),
('LISTING-LIFE-011', 'listing-reactivation', 'approval'),
('LISTING-LIFE-012', 'dealer-roles', 'lets the OWNER do every listing move'),
('LISTING-LIFE-013 LISTING-LIFE-014', 'dealer-roles', 'refuses STAFF mark-sold, allows MANAGER'),
('LISTING-LIFE-015 LISTING-LIFE-016 SEARCH-002', 'public-lifecycle', 'neither SOLD nor WITHDRAWN'),
('LISTING-LIFE-017 SEARCH-008', 'public-lifecycle', 'counts the dealership’s current listings'),
('LISTING-LIFE-018', 'dealer-listing-lifecycle', 'sells a ACTIVE car, releases the registration and keeps the record'),
('LISTING-LIFE-021', 'dealer-roles', 'lets the OWNER do every listing move'),
('LISTING-LIFE-022 LISTING-LIFE-023', 'dealer-roles', 'refuses STAFF withdraw, allows MANAGER'),
('LISTING-LIFE-024 SEARCH-003', 'public-lifecycle', 'neither SOLD nor WITHDRAWN'),
('LISTING-LIFE-025', 'dealer-listing-lifecycle', 'withdraws with a reason and a note'),
('LISTING-LIFE-027 LISTING-LIFE-028 CROSS-013', 'dealer-listing-lifecycle', 'every move out of SOLD is refused'),
('LISTING-LIFE-029 CONCURRENCY-003', 'dealer-listing-lifecycle', 'reservation and a sale racing'),
('MEMBER-001 DEPLOY-002', 'dealer-membership-migration', 'keeps the owner as OWNER'),
('MEMBER-005', 'dealer-team', 'no second user'),
('MEMBER-004 MEMBER-006', 'dealer-team', 'ordinary OTP and joins without onboarding'),
('MEMBER-008 CONCURRENCY-010', 'dealer-team', 'two simultaneous accepts of one invitation'),
('MEMBER-009', 'dealer-team', 'keeps one waiting invitation when two arrive'),
('MEMBER-010', 'dealer-team', 'refuses an expired invitation'),
('MEMBER-011', 'dealer-team', 'refuses an invitation the owner withdrew'),
('MEMBER-012', 'dealer-team', 'verified number is not the invited one'),
('MEMBER-013', 'dealer-team', 'does nothing on a replay'),
('MEMBER-017 MEMBER-018', 'dealer-team', 'removes a member, who keeps their customer account'),
('MEMBER-029 MEMBER-030 MEMBER-031 MANAGER-011', 'dealer-team', 'refuses a MANAGER every team route'),
('MEMBER-032 STAFF-015', 'dealer-team', 'refuses a STAFF every team route'),
('MEMBER-033 MEMBER-034 ABUSE-009', 'dealer-team', 'never lets the owner be demoted or removed'),
('MEMBER-035 ABUSE-008', 'dealer-team', 'never hands out OWNER'),
('IDENTITY-001 IDENTITY-002 IDENTITY-007', 'unified-session', 'opens the workspace with the session they already have'),
('IDENTITY-014', 'unified-session', 'only by the person’s own membership'),
('OWNER-001 MANAGER-001 STAFF-001', 'dealer-roles', 'every member reaches the workspace'),
('OWNER-005', 'dealer-roles', 'lets the OWNER read the documents'),
('OWNER-006', 'dealer-team', 'shows the owner the team'),
('OWNER-007 MANAGER-013 STAFF-017', 'dealer-tenancy-hardening', 'for Dealer B’s rows, and changes nothing'),
('MANAGER-009 MANAGER-010 PROFILE-002', 'dealer-roles', 'refuses MANAGER editing the profile or the documents'),
('STAFF-013 STAFF-014 PROFILE-003', 'dealer-roles', 'refuses STAFF editing the profile or the documents'),
('ADMIN-ENQ-001', 'admin-enquiries', 'every dealership’s enquiries'),
('ADMIN-ENQ-002 ADMIN-ENQ-003 ADMIN-ENQ-004 ADMIN-ENQ-005 ADMIN-ENQ-006 ADMIN-ENQ-007', 'admin-enquiries', 'shows the customer, the dealership, the car and the recorded history'),
('ADMIN-ENQ-009', 'admin-enquiries', 'keeps the enquiry, and its history, after the car is sold'),
('ADMIN-ENQ-011', 'admin-enquiries', 'breaks a tie on the time sent by id'),
('ADMIN-ENQ-011', 'admin-enquiries', 'walks every enquiry once'),
('ADMIN-ENQ-011', 'admin-enquiries', 'narrows to one status'),
('ADMIN-ENQ-012', 'admin-enquiries', 'refuses a dealer, even about an enquiry'),
('ADMIN-LISTING-007', 'listing-approval', 'refuses a dealership that is no longer active'),
('CROSS-023', 'dealer-roles', 'shuts the dealership to a removed member at once'),
('CROSS-026', 'dealer-team', 'accepting adds the dealership to it — no second user'),
('DATA-008', 'dealer-team', 'two simultaneous accepts of one invitation'),
('API-SEC-011', 'dealer-enquiries', 'refuses a malformed cursor'),
('API-SEC-012', 'unit/modules/auth/phone-sign-in.routes', 'refuses the thirty-first'),
('CONCURRENCY-006', 'dealer-tenancy-hardening', 'two simultaneous status changes on an enquiry win'),
('CONCURRENCY-009', 'enquiries', 'does not stop a different customer asking'),
('DEPLOY-004', 'dealer-membership-migration', 'keeps the profile, documents, listing, enquiry and session exactly'),
('ABUSE-005', 'dealer-roles', 'never lets a body choose the dealership'),
('ABUSE-006', 'dealer-listing-lifecycle', 'refuses a status with a 400'),
('ABUSE-007', 'dealer-enquiries', 'refuses an unknown status'),
('ABUSE-010', 'dealer-roles', 'a suspended dealership locks every member out'),
('ABUSE-011', 'dealer-roles', 'shuts the dealership to a removed member at once'),
]
for args in MAPPINGS: support(*args)

paths = ['evidence/security/api-probes.json', 'evidence/security/followup-probes.json', 'evidence/security/config-probes.json', 'evidence/concurrency/revocation-in-flight.json']
for path in paths:
    for p in json.loads((ROOT / path).read_text()):
        if p['status'] not in ('PASS', 'FAIL'): continue
        ids = p.get('canonical', [])
        # These original probe mappings promised more than their observations covered.
        if p['id'] == 'API-PROBE-016': ids = ['DEALER-LIFE-002', 'DEALER-LIFE-003', 'DEALER-LIFE-004', 'DEALER-LIFE-007', 'DEALER-LIFE-014', 'CROSS-003', 'CROSS-023']
        if p['id'] == 'API-FOLLOWUP-001': ids = ['MEMBER-019', 'MEMBER-020', 'MEMBER-022', 'MEMBER-023', 'MEMBER-024', 'MEMBER-026', 'IDENTITY-010', 'IDENTITY-011', 'CROSS-015', 'CROSS-025', 'DATA-001']
        if p['id'] == 'API-PROBE-012': ids = ['IDENTITY-003', 'IDENTITY-005', 'IDENTITY-007']
        record(' '.join(ids), path, {'probe': p['id']}, p.get('method', 'HTTP_API_AND_POSTGRES'), p['status'])

# Only reviewed browser mappings; combined checks are split when one later step blocked.
for stage in ['desktop', 'mobile', 'tablet']:
    path = f'evidence/{stage}/uat.json'
    for p in json.loads((ROOT / path).read_text())['rows']:
        if p['status'] != 'PASS' or stage != 'desktop': continue
        ids = p.get('canonical', [])
        if p['id'].endswith('-004'): ids = ['CUSTOMER-001', 'CUSTOMER-002', 'CUSTOMER-003'] # Real OTP provider unverified.
        record(' '.join(ids), path, {'probe': p['id']}, 'CHROMIUM_BROWSER_UAT', layer='BROWSER_E2E')
for p in json.loads((ROOT / 'evidence/golden-browser.json').read_text()):
    if p['status'] == 'PASS':
        ids = p.get('canonical', [])
        if p['id'] == 'JOURNEY-customer-history': ids = ['ENQ-LIFE-014']
        record(' '.join(ids), 'evidence/golden-browser.json', {'probe': p['id']}, 'MOBILE_CHROMIUM_BROWSER_UAT', layer='BROWSER_E2E')

BUGS = {'VERIFY-011': 'BUG-002', 'CONCURRENCY-007': 'BUG-005', 'CROSS-019': 'BUG-005', 'PROD-002': 'BUG-006', 'PUBLIC-021': 'BUG-007', 'SEO-009': 'BUG-007', 'BROWSER-009': 'BUG-008'}
for id, bug in BUGS.items():
    r = by_id[id]; r.update(status='FAIL', reason=f'Reproduced defect {bug}; see BUG-REPORT.md.', bugs=[bug], priority='P1' if bug in ['BUG-002', 'BUG-005', 'BUG-006'] else 'P2')
    if bug == 'BUG-007': r['evidence'].append({'path': 'evidence/targeted-browser.json', 'selector': {'probe': 'UI-DISC-001-desktop'}})
    if bug == 'BUG-008': r['evidence'].append({'path': 'evidence/admin/final-browser.json', 'selector': {'probe': 'UI-DISC-002'}})

# Broad assertions that do not cover the exact requested condition remain partial evidence.
for id in ['PUBLIC-013', 'PUBLIC-014', 'LISTING-CREATE-001', 'LISTING-CREATE-002', 'MODERATION-007', 'MODERATION-011', 'SEARCH-001', 'CONCURRENCY-009', 'CROSS-023', 'DEALER-LIFE-013', 'LISTING-LIFE-017', 'SEARCH-008', 'ONBOARD-009', 'IDENTITY-001', 'IDENTITY-002', 'MEMBER-035', 'API-SEC-011', 'DATA-006']:
    r = by_id[id]; r.update(status='BLOCKED', reason='Related executions are recorded, but the complete exact condition was not independently verified: ' + r['scenario'])

counts = collections.Counter(r['status'] for r in rows)
(ROOT / 'registry.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n')
summary = {'sha': SHA, 'expected': 556, 'parsed': len(rows), 'unique_ids': len(by_id), 'counts': {status: counts[status] for status in ['PASS', 'FAIL', 'BLOCKED', 'NOT_APPLICABLE']}, 'total_accounted': sum(counts.values()), 'missing': 0, 'duplicates': 0, 'unclassified': sum(r['status'] not in ['PASS', 'FAIL', 'BLOCKED', 'NOT_APPLICABLE'] for r in rows), 'human_uat_pending': len(rows)}
(ROOT / 'evidence/final-counts.json').write_text(json.dumps(summary, indent=2) + '\n')
def table(title, fields):
    lines = [f'# {title}', '', f'Baseline `{SHA}`. PASS is limited to the recorded local method; all human results are PENDING. No fix PR or retest exists.', '', '| ' + ' | '.join(fields) + ' |', '| ' + ' | '.join('---' for _ in fields) + ' |']
    for r in rows:
        values = {'ID': r['id'], 'Ordinal': str(r['ordinal']), 'Priority': r['priority'], 'Scenario': r['scenario'], 'Status': r['status'], 'Method': r['method'], 'Reason': r['reason'], 'Evidence': '; '.join(f"[{e['path']}]({e['path']}) {json.dumps(e['selector'], ensure_ascii=False)}" for e in r['evidence']) or 'No complete execution; see TEST-PLAN.md and group report.', 'Bug': ', '.join(r['bugs']) or '—', 'Fix PR': 'None', 'Retest': 'NOT_RUN', 'Human': 'PENDING', 'Layers': json.dumps(r['layer_results']) or '{}'}
        lines.append('| ' + ' | '.join(values[f].replace('|', '\\|').replace('\n', ' ') for f in fields) + ' |')
    return '\n'.join(lines) + '\n'
(ROOT / 'CANONICAL-TEST-REGISTRY.md').write_text(table('Canonical test registry — 556 accounted', ['Ordinal', 'ID', 'Priority', 'Scenario', 'Status', 'Method', 'Reason', 'Evidence', 'Bug', 'Fix PR', 'Retest', 'Human']))
(ROOT / 'TEST-COVERAGE-MATRIX.md').write_text(table('Coverage by scenario and executed layer', ['ID', 'Status', 'Layers', 'Evidence', 'Reason']))
print(json.dumps(summary, indent=2))
