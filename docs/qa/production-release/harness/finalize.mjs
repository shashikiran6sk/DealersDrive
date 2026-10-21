// Final accounting: merge every area's results (merge.mjs), apply the reviewed triage in
// registry/triage.json (the harness verdict is kept as `harnessStatus`), assert the Part X
// completeness rule, and write registry/results.final.json, TEST-TRACEABILITY.csv and
// EVIDENCE/final-counts.json.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');
const REG = resolve(ROOT, 'registry');
// The application under test: this branch adds only QA files on top of main.
const SHA =
  process.env.CERT_SHA ??
  execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
const STATUSES = ['PASS', 'FAIL', 'BLOCKED', 'NOT_APPLICABLE'];

execFileSync(process.execPath, [resolve(here, 'merge.mjs')], { stdio: 'ignore' });
const merged = JSON.parse(readFileSync(resolve(REG, 'results.json'), 'utf8'));
const triage = JSON.parse(readFileSync(resolve(REG, 'triage.json'), 'utf8'));
const { scenarios } = JSON.parse(readFileSync(resolve(REG, 'registry.json'), 'utf8'));
const canonicalIds = new Set(scenarios.map((s) => s.id));

const FILE_OF = {
  priority: 'c01-priority.mjs',
  public: 'c02-public.mjs',
  'auth-customer-saved': 'c03-auth-customer-saved.mjs',
  enquiry: 'c04-enquiry.mjs',
  'onboard-verify': 'c05-onboard-verify.mjs',
  'member-identity-rbac': 'c06-member-identity-rbac.mjs',
  listing: 'c07-listing.mjs',
  'admin-dealerlife-cross': 'c08-admin-dealerlife-cross.mjs',
  'cross-search-data': 'c09-cross-search-data.mjs',
  security: 'c10-security.mjs',
  'notify-recovery-obs': 'c11-notify-recovery-obs.mjs',
  'prod-deploy': 'c12-prod-deploy.mjs',
  'browser-public-seo': 'b01-public-seo.mjs',
  'browser-ux': 'b02-browser-ux.mjs',
  'browser-golden': 'b03-golden.mjs',
  delta: 'd01-delta.mjs',
  'stale-suspension': 'd02-stale-suspension.mjs',
  'console-suspension': 'd03-console-suspension.mjs',
  'backup-restore': 'd04-backup-restore.mjs',
  'msg91-faults': 'd05-msg91-faults.mjs',
  'agent-uat': 'u01-agent-uat.mjs',
  'agent-uat-touch': 'u02-touch-history.mjs',
  'gallery-browser': 'u03-gallery.mjs',
  'recovery-browser': 'u04-recovery.mjs',
  'retest-new012': 'retest-new012-enquiry-race.mjs',
  analysis: '(analysis — see note)',
};
const fileOf = (area) =>
  FILE_OF[area] ?? (area?.startsWith('retest-') ? `${area}.mjs` : (area ?? ''));

const P0 = ['API-SEC', 'ABUSE', 'STORAGE', 'MEMBER', 'IDENTITY', 'DATA'];
const P1 = [
  'AUTH',
  'ENQ-CREATE',
  'ENQ-LIFE',
  'ONBOARD',
  'VERIFY',
  'DEALER-LIFE',
  'LISTING-CREATE',
  'MODERATION',
  'LISTING-LIFE',
  'OWNER',
  'MANAGER',
  'STAFF',
  'ADMIN-AUTH',
  'ADMIN-DEALER',
  'ADMIN-LISTING',
  'ADMIN-ENQ',
  'CROSS',
  'SEARCH',
  'CONCURRENCY',
  'GOLDEN',
  'PROD',
  'DEPLOY',
];
const priorityOf = (section) => (P0.includes(section) ? 'P0' : P1.includes(section) ? 'P1' : 'P2');
const MANUAL = new Set([
  ...Array.from({ length: 15 }, (_, i) => `AUTH-${String(i + 1).padStart(3, '0')}`),
  'ONBOARD-002',
  'ONBOARD-003',
  'BROWSER-002',
  'BROWSER-003',
  'BROWSER-004',
  'BROWSER-005',
  'BROWSER-006',
  'NOTIFY-001',
  'NOTIFY-002',
  'PROD-007',
  'PROD-008',
  'PROD-009',
  'PROD-010',
  'PROD-012',
  'DEPLOY-001',
  'DEPLOY-009',
  ...Array.from({ length: 10 }, (_, i) => `GOLDEN-${String(i + 1).padStart(3, '0')}`),
]);
const TYPE_OF = {
  API: 'AUTOMATED_API',
  SECURITY: 'AUTOMATED_API',
  TENANT: 'AUTOMATED_API',
  RBAC: 'AUTOMATED_API',
  CONCURRENCY: 'AUTOMATED_INTEGRATION',
  DATABASE: 'AUTOMATED_INTEGRATION',
  INTEGRATION: 'AUTOMATED_INTEGRATION',
  UNIT: 'AUTOMATED_UNIT',
  STORAGE: 'AUTOMATED_API',
  BROWSER: 'AUTOMATED_E2E',
  BROWSER_E2E: 'AUTOMATED_E2E',
  A11Y: 'AUTOMATED_E2E',
  SEO: 'AUTOMATED_E2E',
  AGENT_UAT: 'AUTOMATED_E2E',
  STATIC: 'STATIC_VERIFICATION',
  RECOVERY: 'AUTOMATED_INTEGRATION',
  PERFORMANCE: 'AUTOMATED_INTEGRATION',
  NOTIFY: 'AUTOMATED_INTEGRATION',
};

const out = {};
for (const [id, rec] of Object.entries(merged)) {
  const t = triage[id];
  out[id] = {
    ...rec,
    ...(t?.status ? { harnessStatus: rec.status, status: t.status } : {}),
    ...(t?.bug ? { bug: t.bug } : {}),
    ...(t?.reason ? { triage: t.reason } : {}),
    canonical: canonicalIds.has(id),
  };
}

const tally = (filter) => {
  const c = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const [id, rec] of Object.entries(out))
    if (filter(id) && STATUSES.includes(rec.status)) c[rec.status] += 1;
  return c;
};
const canonical = tally((id) => canonicalIds.has(id));
const missing = scenarios.filter((s) => !out[s.id]).map((s) => s.id);
const unclassified = scenarios
  .filter((s) => out[s.id] && !STATUSES.includes(out[s.id].status))
  .map((s) => s.id);
const discovered = tally((id) => !canonicalIds.has(id));
const discoveredIds = Object.keys(out).filter((id) => !canonicalIds.has(id));
const groupOf = (id) =>
  /^(SEC|API|AUTH|ADMIN-SESSION|ADMIN-RBAC|DOC|SALES)-DISC|^SEC-DISC/.test(id)
    ? 'security'
    : /^(R2\d\d|CAMPAIGN|BUG-NEW|ORIG)/.test(id)
      ? 'regression'
      : /^(UAT|PERF|CI|DEP|RECOVERY|DATA|DOC-DISC-002)/.test(id)
        ? 'exploratory'
        : 'audit';
const groups = {};
for (const id of discoveredIds) (groups[groupOf(id)] ??= []).push(id);

const counts = {
  sha: SHA,
  canonical: {
    expected: 556,
    ...canonical,
    accounted: STATUSES.reduce((n, s) => n + canonical[s], 0),
    missing: missing.length,
    unclassified: unclassified.length,
  },
  discovered: {
    total: discoveredIds.length,
    ...discovered,
    byGroup: Object.fromEntries(Object.entries(groups).map(([g, ids]) => [g, ids.length])),
  },
};
writeFileSync(resolve(REG, 'results.final.json'), `${JSON.stringify(out, null, 2)}\n`);
writeFileSync(
  resolve(ROOT, 'EVIDENCE', 'final-counts.json'),
  `${JSON.stringify(counts, null, 2)}\n`,
);

const csv = (v) =>
  `"${String(v ?? '')
    .replace(/"/g, '""')
    .replace(/\n/g, ' ')}"`;
const header = [
  'Scenario ID',
  'Canonical #',
  'Functional category',
  'Scenario description',
  'Priority',
  'Source requirement / PR',
  'Test type',
  'Test file / location',
  'Execution environment',
  'Execution status',
  'Result',
  'Harness verdict (before triage)',
  'Evidence reference',
  'Defect ID',
  'Blocker reason',
  'Manual UAT requirement',
  'Notes',
];
const ENV = `local isolated container @ ${SHA.slice(0, 7)} (PostgreSQL 16, Node 24, Chromium 141)`;
const rows = [header.map(csv).join(',')];
for (const s of scenarios) {
  const rec = out[s.id];
  const types = [...new Set((rec.layers ?? []).map((l) => TYPE_OF[l] ?? `AUTOMATED_${l}`))].join(
    ' + ',
  );
  rows.push(
    [
      s.id,
      s.number,
      s.sectionTitle,
      s.text,
      priorityOf(s.section),
      'Canonical 556 (certification brief) · reconciled against main 6e39a9a',
      rec.status === 'BLOCKED' && !rec.layers?.length
        ? 'MANUAL_REQUIRED'
        : types || 'AUTOMATED_API',
      `docs/qa/production-release/harness/${fileOf(rec.area)}`,
      ENV,
      rec.status === 'BLOCKED' ? 'NOT_EXECUTED' : 'EXECUTED',
      rec.status,
      rec.harnessStatus ?? rec.status,
      `docs/qa/production-release/EVIDENCE/${rec.area ?? ''}/`,
      rec.bug ?? '',
      rec.status === 'BLOCKED' ? (rec.triage ?? rec.note) : '',
      MANUAL.has(s.id) ? 'YES' : 'no',
      rec.triage ? `${rec.note} | TRIAGE: ${rec.triage}` : rec.note,
    ]
      .map(csv)
      .join(','),
  );
}
for (const id of discoveredIds) {
  const rec = out[id];
  const types = [...new Set((rec.layers ?? []).map((l) => TYPE_OF[l] ?? `AUTOMATED_${l}`))].join(
    ' + ',
  );
  rows.push(
    [
      id,
      '',
      `Discovered (${groupOf(id)})`,
      rec.note,
      '',
      'Discovered during this campaign or carried from the prior fix campaign',
      types || 'AUTOMATED_API',
      `docs/qa/production-release/harness/${fileOf(rec.area)}`,
      ENV,
      rec.status === 'BLOCKED' ? 'NOT_EXECUTED' : 'EXECUTED',
      rec.status,
      rec.harnessStatus ?? rec.status,
      rec.evidence?.length &&
      typeof rec.evidence[0] === 'string' &&
      rec.evidence[0].startsWith('EVIDENCE/')
        ? rec.evidence.map((e) => `docs/qa/production-release/${e}`).join(' ')
        : `docs/qa/production-release/EVIDENCE/${rec.area ?? ''}/`,
      rec.bug ?? '',
      rec.status === 'BLOCKED' ? rec.note : '',
      'no',
      rec.triage ? `TRIAGE: ${rec.triage}` : '',
    ]
      .map(csv)
      .join(','),
  );
}
writeFileSync(resolve(ROOT, 'TEST-TRACEABILITY.csv'), `${rows.join('\n')}\n`);

console.log(JSON.stringify(counts, null, 2));
if (counts.canonical.accounted !== 556 || missing.length || unclassified.length) {
  console.log('CERTIFICATION INCOMPLETE', { missing, unclassified });
  process.exit(1);
}
console.log('COMPLETENESS: OK');
