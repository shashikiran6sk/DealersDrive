#!/usr/bin/env python3
"""Run repository commands, keep raw output private, save sanitized evidence."""
import datetime
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = Path(__file__).resolve().parent / 'evidence' / 'ci'

def sanitize(value):
    value = re.sub(r'\x1b\[[0-9;]*m', '', value)
    value = re.sub(r'dev-otp:[^\s"\x27,}]+', '[REDACTED_OTP_PROOF]', value)
    value = re.sub(r'\b123456\b', '[REDACTED_TEST_OTP]', value)
    value = re.sub(r'(?i)(dd_session=)[^;\s"\x27]+', r'\1[REDACTED]', value)
    value = re.sub(r'(?i)(https?://|postgresql://)([^/@\s]+:[^/@\s]+)@', r'\1[REDACTED]@', value)
    value = re.sub(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[REDACTED_EMAIL]', value)
    value = re.sub(r'(?i)("?(?:accessToken|signUpToken|tokenHash|token|password|cookie|authorization|clientSecret|secretAccessKey)"?\s*[:=]\s*)[^\n,}]+', r'\1[REDACTED]', value)
    return value

def run(label, command):
    env = dict(os.environ)
    env.update(PATH='/tmp/dd-cert-bin:' + env['PATH'], COREPACK_HOME='/tmp/dd-cert-corepack',
               TURBO_UI='false', TURBO_FORCE='true', NEXT_TELEMETRY_DISABLED='1')
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    raw = Path('/tmp') / f'dd-cert-{label}-raw.log'
    with raw.open('w') as output:
        result = subprocess.run(command, cwd=ROOT, env=env, stdout=output, stderr=subprocess.STDOUT)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    (EVIDENCE / f'{label}.log').write_text(sanitize(raw.read_text()))
    metadata = {'command': command, 'sha': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
                'start_utc': started, 'end_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'exit_code': result.returncode, 'log': f'evidence/ci/{label}.log', 'cache': 'TURBO_FORCE=true'}
    (EVIDENCE / f'{label}.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(json.dumps(metadata))
    print(sanitize(raw.read_text()[-5000:]))
    return result.returncode

if __name__ == '__main__':
    sys.exit(run(sys.argv[1], sys.argv[2:]))
