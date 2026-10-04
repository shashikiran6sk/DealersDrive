"""Validate independent canonical counts, source preservation and traceability."""
import collections
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
SHA = 'd6ae115359c4d0ae7ab0fd5115336291666cbb08'
GROUP_COUNTS = {'PUBLIC':24,'AUTH':15,'CUSTOMER':10,'SAVED':10,'ENQ-CREATE':18,'ENQ-LIFE':21,'ONBOARD':18,'VERIFY':14,'DEALER-LIFE':18,'LISTING-CREATE':16,'MODERATION':18,'MEDIA':13,'LISTING-LIFE':31,'MEMBER':35,'IDENTITY':14,'OWNER':8,'MANAGER':13,'STAFF':17,'PROFILE':8,'ADMIN-AUTH':10,'ADMIN-DEALER':10,'ADMIN-LISTING':10,'ADMIN-ENQ':12,'CROSS':29,'SEARCH':12,'DATA':11,'API-SEC':14,'STORAGE':8,'NOTIFY':5,'RECOVERY':13,'CONCURRENCY':10,'BROWSER':12,'UX':12,'SEO':10,'PROD':13,'DEPLOY':10,'OBS':12,'ABUSE':12,'GOLDEN':10}
expected = {f'{group}-{n:03}' for group,count in GROUP_COUNTS.items() for n in range(1,count+1)}
assert len(expected) == 556
rows = json.loads((ROOT / 'registry.json').read_text())
ids = [r['id'] for r in rows]
assert len(rows) == len(set(ids)) == 556
assert set(ids) == expected, (expected-set(ids),set(ids)-expected)
assert sorted(r['ordinal'] for r in rows) == list(range(1,557))
statuses = ['PASS','FAIL','BLOCKED','NOT_APPLICABLE']
counts = {status:sum(r['status']==status for r in rows) for status in statuses}
assert sum(counts.values()) == 556
assert json.loads((ROOT/'evidence/final-counts.json').read_text())['counts'] == counts
bug_list = json.loads((ROOT / 'bugs.json').read_text()); bugs = {b['id']:b for b in bug_list}
assert len(bugs) == len(bug_list)
additional = json.loads((ROOT / 'additional-tests.json').read_text())
assert len({r['id'] for r in additional}) == len(additional)
known_tests = set(ids) | {r['id'] for r in additional}
evidence_count = 0
for row in rows + additional:
    assert row['sha'] == SHA
    assert row['status'] in statuses
    assert row['fix_pr'] is None and row['retest'] == 'NOT_RUN'
    if row['status'] == 'PASS': assert row['evidence'], row['id']
    if row['status'] == 'FAIL': assert row['bugs'] and row['evidence'], row['id']
    for bug in row['bugs']:
        assert bug in bugs and row['id'] in bugs[bug]['tests'], (row['id'],bug)
    if row in rows:
        assert row['reason'] and row['method'] and row['human_uat']=='PENDING'
        if row['status'] == 'NOT_APPLICABLE': assert 'not applicable' in row['reason'].lower()
    for evidence in row['evidence']:
        path = ROOT / evidence['path']; assert path.is_file(), str(path)
        evidence_count += 1
        selector = evidence.get('selector')
        if path.suffix == '.json' and isinstance(selector,dict):
            data = json.loads(path.read_text())
            if 'assertion' in selector:
                candidates = [a for a in data['assertions'] if a['file']==selector['file'] and a['name']==selector['assertion']]
                assert candidates, (row['id'],selector)
                if row['status'] == 'PASS': assert all(a['status']=='passed' for a in candidates)
            elif 'probe' in selector:
                entries = data if isinstance(data,list) else data['rows']
                assert any(a['id']==selector['probe'] for a in entries), (row['id'],selector)
for bug in bugs.values():
    assert bug['tests'] and set(bug['tests']) <= known_tests, bug['id']
    assert bug['status']=='OPEN' and bug['fix_pr'] is None and bug['retest']=='NOT_RUN'
    for path in bug['evidence']: assert (ROOT/path).is_file(), path
assert sum(b['severity']=='P1' for b in bugs.values())==3
required = ['README','CANONICAL-TEST-REGISTRY','TEST-PLAN','TEST-RESULTS','TEST-COVERAGE-MATRIX','LIFECYCLE-MATRIX','RBAC-MATRIX','IDENTITY-MATRIX','API-SECURITY','TENANT-ISOLATION','DATA-INTEGRITY','CONCURRENCY','FAILURE-RECOVERY','BROWSER-COMPATIBILITY','RESPONSIVE-QA','ACCESSIBILITY-QA','SEO-QA','PRODUCTION-CONFIG-QA','PERFORMANCE-SMOKE','AGENT-UAT','HUMAN-UAT','BUG-REPORT','RETEST-REPORT','FINAL-CERTIFICATION']
for name in required: assert (ROOT/f'{name}.md').is_file(), name
human = (ROOT/'HUMAN-UAT.md').read_text()
for row in rows: assert f"HUMAN-UAT-{row['ordinal']:03} — {row['id']}" in human
assert len(re.findall(r'Human result: \*\*PENDING\*\*',human)) == 556+15
source_validated = False
if len(sys.argv)>1:
    source = Path(sys.argv[1]).read_text()
    source_hash = hashlib.sha256(source.encode()).hexdigest()
    assert source_hash == json.loads((ROOT/'evidence/registry-validation.json').read_text())['source_sha256']
    section = source.split('# CANONICAL TEST REGISTRY\n',1)[1].split('# PART D',1)[0]
    numbered = {int(n):s for n,s in re.findall(r'(?m)^(\d+)\. (.+)$',section)}
    assert len(numbered)==556
    for r in rows: assert r['scenario']==numbered[r['ordinal']],r['id']
    source_validated = True
head = subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT.parents[2],text=True).strip()
assert head==SHA
tracked_diff = subprocess.check_output(['git','diff','--name-only',SHA],cwd=ROOT.parents[2],text=True).splitlines()
assert not tracked_diff, tracked_diff
result = {'sha':SHA,'expected':556,'accounted':556,'counts':counts,'missing':0,'duplicates':0,'unclassified':0,'source_verbatim_validated':source_validated,'evidence_references_checked':evidence_count,'bugs':len(bugs),'open_p1':3,'human_tickets':556,'human_priority_journeys':15,'human_results':'PENDING','required_documents':len(required),'tracked_application_diff':tracked_diff,'decision':'NO GO'}
(ROOT/'evidence/dossier-validation.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
