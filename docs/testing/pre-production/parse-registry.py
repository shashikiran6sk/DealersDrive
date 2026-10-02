#!/usr/bin/env python3
"""Parse the supplied numbered specification without dropping header overflow."""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import re

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
args = parser.parse_args()
raw = args.source.read_text()
section = raw.split('# CANONICAL TEST REGISTRY\n', 1)[1].split('# PART D', 1)[0]
blocks = re.split(r'(?m)^#{1,2} (.+? — ([A-Z-]+)-001 → \2-(\d+))\s*$', section)
rows, corrections = [], []
browser_groups = {'PUBLIC', 'CUSTOMER', 'BROWSER', 'UX', 'SEO', 'GOLDEN'}
for index in range(1, len(blocks), 4):
    title, prefix, declared, body = blocks[index:index + 4]
    scenarios = re.findall(r'(?m)^(\d+)\. (.+)$', body)
    if len(scenarios) != int(declared):
        corrections.append({'prefix': prefix, 'declared': int(declared), 'actual': len(scenarios)})
    for local, (number, scenario) in enumerate(scenarios, 1):
        critical = prefix not in {'MEDIA', 'BROWSER', 'UX', 'SEO', 'NOTIFY', 'PUBLIC'}
        layers = ['API', 'INTEGRATION', 'DATABASE']
        if prefix in browser_groups or any(word in scenario.lower() for word in ['refresh', 'dashboard', 'navigation', 'gallery', 'visual', 'login', 'session']):
            layers += ['BROWSER_E2E', 'AGENT_UAT']
        if critical:
            layers += ['SECURITY', 'HUMAN_UAT']
        rows.append({'id': f'{prefix}-{local:03}', 'ordinal': int(number), 'group': prefix,
                     'scenario': scenario, 'priority': 'P1' if critical else 'P2',
                     'layers': layers, 'status': 'BLOCKED', 'method': 'NOT_EXECUTED',
                     'reason': 'Campaign execution pending; no PASS inferred from source inspection.',
                     'evidence': [], 'bugs': [], 'fix_pr': None, 'retest': 'NOT_RUN',
                     'human_uat': 'PENDING'})
ids = [row['id'] for row in rows]
ordinals = [row['ordinal'] for row in rows]
validation = {'expected': 556, 'parsed': len(rows), 'duplicate_ids': len(ids) - len(set(ids)),
              'missing_ordinals': sorted(set(range(1, 557)) - set(ordinals)),
              'duplicate_ordinals': len(ordinals) - len(set(ordinals)),
              'source_sha256': hashlib.sha256(raw.encode()).hexdigest(),
              'heading_corrections': corrections}
assert validation['parsed'] == 556 and validation['duplicate_ids'] == 0
assert not validation['missing_ordinals'] and validation['duplicate_ordinals'] == 0
root = Path(__file__).resolve().parent
(root / 'registry.json').write_text(json.dumps(rows, indent=2) + '\n')
(root / 'evidence' / 'registry-validation.json').parent.mkdir(parents=True, exist_ok=True)
(root / 'evidence' / 'registry-validation.json').write_text(json.dumps(validation, indent=2) + '\n')
text = '# Canonical test registry\n\nBaseline SHA: `d6ae115359c4d0ae7ab0fd5115336291666cbb08`.\n\n'
text += 'All 556 original numbered scenarios are preserved verbatim. The supplied ENQ-CREATE heading ends at 017 but contains 18 entries; ADMIN-DEALER ends at 009 but contains 10. This registry extends those groups to 018 and 010. No application expectations were changed.\n\n'
text += '| Ordinal | ID | Scenario |\n| --- | --- | --- |\n'
for row in rows:
    text += f"| {row['ordinal']} | {row['id']} | {row['scenario']} |\n"
(root / 'CANONICAL-TEST-REGISTRY.md').write_text(text)
print(json.dumps(validation, indent=2))
