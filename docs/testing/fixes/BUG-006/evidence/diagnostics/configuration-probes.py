#!/usr/bin/env python3
"""Exercise real boot validation with inert credentials and no provider calls."""
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[6]
mode = sys.argv[1]
assert mode in ['baseline', 'fixed']
source = root / 'apps/api/src/config/env.ts'
sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
base = {'PATH': os.environ['PATH'], 'NODE_ENV': 'production', 'APP_ENV': 'production',
        'AUTH_MODE': 'cookie', 'WEB_ORIGIN': 'https://marketplace.example.test',
        'WEB_BASE_URL': 'https://marketplace.example.test', 'API_BASE_URL': 'https://api.example.test',
        'MEDIA_BASE_URL': 'https://api.example.test/media',
        'DATABASE_URL': 'postgresql://dealersdrive@localhost:5432/dealersdrive_cert',
        'STORAGE_DRIVER': 'r2', 'CACHE_DRIVER': 'postgres', 'MAIL_DRIVER': 'resend',
        'MAIL_FROM': 'Certification <updates@example.test>', 'PHONE_OTP_DRIVER': 'msg91',
        'SESSION_SECRET': secrets.token_hex(32), 'GOOGLE_CLIENT_ID': secrets.token_hex(16),
        'GOOGLE_CLIENT_SECRET': secrets.token_hex(32), 'RESEND_API_KEY': secrets.token_hex(32),
        'MSG91_AUTH_KEY': secrets.token_hex(32), 'MSG91_WIDGET_ID': secrets.token_hex(16),
        'MSG91_WIDGET_TOKEN': secrets.token_hex(32), 'S3_ACCESS_KEY_ID': secrets.token_hex(16),
        'S3_SECRET_ACCESS_KEY': secrets.token_hex(32), 'S3_ENDPOINT': 'https://storage.example.test',
        'GOOGLE_CALLBACK_URL': 'https://api.example.test/v1/auth/google/callback',
        'JOBS_ENABLED': 'false', 'WORKER_INLINE': 'false', 'DOCS_ENABLED': 'false',
        'METRICS_ENABLED': 'false', 'GRAFANA_CLOUD_LOGS_ENABLED': 'false', 'LOG_LEVEL': 'silent'}
cases = [
    ('CONFIG-001', [], 'Complete inert R2 production config', {}, False, None),
    ('CONFIG-002', ['PROD-002'], 'Production refuses MinIO', {'STORAGE_DRIVER': 'minio'}, True, 'STORAGE_DRIVER'),
    ('CONFIG-003', ['PROD-003'], 'Production refuses fake OTP', {'PHONE_OTP_DRIVER': 'fake'}, True, 'PHONE_OTP_DRIVER'),
    ('CONFIG-004', ['PROD-004'], 'Production refuses SMTP/Mailpit', {'MAIL_DRIVER': 'smtp'}, True, 'MAIL_DRIVER'),
    ('CONFIG-005', [], 'Production refuses dev auth', {'AUTH_MODE': 'dev'}, True, 'AUTH_MODE'),
    ('CONFIG-006', [], 'Production refuses local storage', {'STORAGE_DRIVER': 'local'}, True, 'STORAGE_DRIVER'),
    ('CONFIG-007', [], 'Production refuses memory cache', {'CACHE_DRIVER': 'memory'}, True, 'CACHE_DRIVER'),
    ('CONFIG-008', [], 'Production refuses console mail', {'MAIL_DRIVER': 'console'}, True, 'MAIL_DRIVER'),
]
for app in ['local', 'preview', 'dev', 'production']:
    cases.append((f'BUG006-MINIO-{app}', [], 'NODE_ENV production always refuses MinIO', {'APP_ENV': app, 'STORAGE_DRIVER': 'minio'}, True, 'STORAGE_DRIVER'))
for node in ['development', 'test']:
    for driver in ['local', 'minio', 'r2']:
        cases.append((f'BUG006-{node}-{driver}', [], 'Development/test storage remains supported', {'NODE_ENV': node, 'APP_ENV': 'local', 'STORAGE_DRIVER': driver}, False, None))
for key in ['S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']:
    cases.append((f'BUG006-missing-{key}', [], 'R2 still requires its credential', {key: ''}, True, key))
cases.append(('BUG006-driver-omitted', [], 'Production default storage remains prohibited', {'STORAGE_DRIVER': None}, True, 'STORAGE_DRIVER'))
cases.append(('BUG006-unknown-driver', [], 'Unknown adapter remains invalid', {'STORAGE_DRIVER': 'unknown'}, True, 'STORAGE_DRIVER'))
boot_targets = {}
for entry in ['index', 'worker']:
    for driver in ['local', 'minio']:
        test_id = f'BUG006-boot-{entry}-{driver}'
        boot_targets[test_id] = root / f'apps/api/src/{entry}.ts'
        cases.append((test_id, [], 'Actual entrypoint refuses development storage before startup', {'STORAGE_DRIVER': driver}, True, 'STORAGE_DRIVER'))
rows = []
with tempfile.TemporaryDirectory(prefix='dd-bug006-') as temporary:
    cwd = Path(temporary) / 'a/b/c'
    cwd.mkdir(parents=True)
    assert not (cwd / '.env').exists()
    assert not (cwd / '../../.env').resolve().exists()
    for test_id, canonical, title, overrides, reject, issue in cases:
        configured = {**base, **overrides}
        configured = {k: v for k, v in configured.items() if v is not None}
        program = f"import {{ env }} from {json.dumps(str(source))}; console.log(JSON.stringify({{accepted:true,storageDriver:env.STORAGE_DRIVER,nodeEnv:env.NODE_ENV}}))"
        if test_id in boot_targets:
            program = f"import {json.dumps(str(boot_targets[test_id]))}; console.log('Unexpected boot reached')"
        result = subprocess.run(['node', '--import', str(root / 'apps/api/node_modules/tsx/dist/loader.mjs'), '--input-type=module', '-e',
                                 program],
                                cwd=cwd, env=configured, capture_output=True, text=True, timeout=15)
        rejected = result.returncode != 0
        issue_present = issue is None or issue in result.stderr
        passed = rejected == reject and (not reject or issue_present)
        if not reject and not rejected:
            observed = json.loads(result.stdout)
            passed = passed and observed['storageDriver'] == overrides.get('STORAGE_DRIVER', 'r2')
        if test_id == 'CONFIG-001' and rejected:
            diagnostic = result.stderr.replace(configured['SESSION_SECRET'], '[REDACTED]')
            for key, value in configured.items():
                if any(word in key for word in ['SECRET', 'TOKEN', 'KEY']):
                    diagnostic = diagnostic.replace(value, '[REDACTED]')
            print(diagnostic[:1800])
        rows.append({'id': test_id, 'canonical': canonical, 'title': title,
                     'status': 'PASS' if passed else 'FAIL', 'exit_code': result.returncode,
                     'accepted': not rejected, 'expectedRejection': reject,
                     'expectedIssue': issue, 'issuePresent': issue_present,
                     'method': 'ISOLATED_ACTUAL_ENTRYPOINT' if test_id in boot_targets else 'ISOLATED_REAL_ENV_VALIDATOR_NO_PROVIDER_CALLS', 'sha': sha})
        print(test_id, rows[-1]['status'], 'rejected' if rejected else 'accepted')
report = {'bug': 'BUG-006', 'mode': mode, 'sha': sha, 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
          'inertGeneratedCredentials': True, 'dotenvIsolated': True, 'databaseOrProviderCalls': False,
          'cases': rows, 'counts': {status: sum(r['status'] == status for r in rows) for status in ['PASS', 'FAIL']}}
(Path(__file__).resolve().parent.parent / f'configuration-{mode}.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report['counts']))
sys.exit(0 if all(row['status'] == 'PASS' for row in rows) else 1)
