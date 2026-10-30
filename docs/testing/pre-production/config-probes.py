#!/usr/bin/env python3
"""Validate production configuration using generated inert provider fixtures."""
import json
import os
from pathlib import Path
import secrets
import subprocess

root = Path(__file__).resolve().parents[3]
base = dict(os.environ)
base.update(NODE_ENV='production', APP_ENV='production', AUTH_MODE='cookie',
            WEB_ORIGIN='https://marketplace.example.test', WEB_BASE_URL='https://marketplace.example.test',
            API_BASE_URL='https://api.example.test', DATABASE_URL='postgresql://dealersdrive@localhost:5432/dealersdrive_cert',
            STORAGE_DRIVER='r2', CACHE_DRIVER='postgres', MAIL_DRIVER='resend',
            MAIL_FROM='Certification <updates@example.test>', PHONE_OTP_DRIVER='msg91',
            SESSION_SECRET=secrets.token_hex(32), GOOGLE_CLIENT_ID=secrets.token_hex(16),
            GOOGLE_CLIENT_SECRET=secrets.token_hex(32), RESEND_API_KEY=secrets.token_hex(32),
            MSG91_AUTH_KEY=secrets.token_hex(32), MSG91_WIDGET_ID=secrets.token_hex(16),
            MSG91_WIDGET_TOKEN=secrets.token_hex(32), S3_ACCESS_KEY_ID=secrets.token_hex(16),
            S3_SECRET_ACCESS_KEY=secrets.token_hex(32), S3_ENDPOINT='https://storage.example.test',
            GOOGLE_CALLBACK_URL='https://api.example.test/v1/auth/google/callback',
            JOBS_ENABLED='false', WORKER_INLINE='false', DOCS_ENABLED='false', METRICS_ENABLED='false')
rows = []
cases = [
    ('CONFIG-001', [], 'Production validation accepts the complete inert fixture', {}, False),
    ('CONFIG-002', ['PROD-002'], 'Production refuses MinIO', {'STORAGE_DRIVER': 'minio'}, True),
    ('CONFIG-003', ['PROD-003'], 'Production refuses fake OTP', {'PHONE_OTP_DRIVER': 'fake'}, True),
    ('CONFIG-004', ['PROD-004'], 'Production refuses the SMTP/Mailpit adapter', {'MAIL_DRIVER': 'smtp'}, True),
    ('CONFIG-005', [], 'Production refuses the development session resolver', {'AUTH_MODE': 'dev'}, True),
    ('CONFIG-006', [], 'Production refuses local disk storage', {'STORAGE_DRIVER': 'local'}, True),
    ('CONFIG-007', [], 'Production refuses in-process rate limiting', {'CACHE_DRIVER': 'memory'}, True),
    ('CONFIG-008', [], 'Production refuses console email', {'MAIL_DRIVER': 'console'}, True),
]
for id, canonical, title, overrides, rejection_expected in cases:
    result = subprocess.run([str(root / 'apps/api/node_modules/.bin/tsx'), '-e',
                             "import './src/config/env.ts'; console.log('configuration accepted')"],
                            cwd=root / 'apps/api', env={**base, **overrides}, capture_output=True, text=True)
    rejected = result.returncode != 0
    rows.append({'id': id, 'canonical': canonical, 'title': title,
                 'status': 'PASS' if rejected == rejection_expected else 'FAIL',
                 'exit_code': result.returncode, 'accepted': not rejected,
                 'method': 'ISOLATED_PRODUCTION_ENV_VALIDATION',
                 'sha': 'd6ae115359c4d0ae7ab0fd5115336291666cbb08'})
    print(id, rows[-1]['status'], 'rejected' if rejected else 'accepted')
(Path(__file__).resolve().parent / 'evidence/security/config-probes.json').write_text(json.dumps(rows, indent=2) + '\n')
