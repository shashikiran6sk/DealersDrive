// Final accounting after the fix stack: baseline (registry/results.json, the
// original audit at d6ae115) overlaid with the post-merge retest on main
// (retest/final/*.json). Every record keeps its baseline status, so a FAIL that a
// merged PR fixed reads "baseline FAIL → final PASS", never a silent PASS.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CERT = resolve(here, '..');
const { scenarios } = JSON.parse(readFileSync(resolve(CERT, 'registry/registry.json'), 'utf8'));
const baseline = JSON.parse(readFileSync(resolve(CERT, 'registry/results.json'), 'utf8'));
const finalDir = resolve(CERT, 'retest/final');
const latest = {};
for (const f of readdirSync(finalDir).filter(
  (x) => x.endsWith('.json') && x !== 'results.final.json',
)) {
  Object.assign(latest, JSON.parse(readFileSync(resolve(finalDir, f), 'utf8')));
}
const FIXED_BY = {
  'VERIFY-011': '#232 (approval prerequisites)',
  'PROD-002': '#237 (production requires r2)',
  'PUBLIC-021': '#209 (branded 404)',
  'SEO-009': '#209 (branded 404)',
  'SEO-010': '#209 (safe outage handling)',
};
const out = {};
const transitions = [];
for (const s of scenarios) {
  const b = baseline[s.id];
  const f = latest[s.id];
  const rec = f ?? b;
  if (!rec) continue;
  const baselineStatus = b?.status ?? 'NOT_RUN_AT_BASELINE';
  out[s.id] = {
    ...rec,
    baseline: baselineStatus,
    finalSource: f ? 'retest on main f74401a' : 'baseline (not re-run)',
    ...(FIXED_BY[s.id] && baselineStatus === 'FAIL' ? { fixedBy: FIXED_BY[s.id] } : {}),
  };
  if (baselineStatus !== rec.status)
    transitions.push(
      `${s.id}: ${baselineStatus} → ${rec.status}${out[s.id].fixedBy ? ` (fixed by ${out[s.id].fixedBy})` : ''}`,
    );
}
for (const [id, rec] of Object.entries(latest))
  if (!scenarios.some((s) => s.id === id))
    out[id] = {
      ...rec,
      baseline: baseline[id]?.status ?? 'NOT_RUN_AT_BASELINE',
      nonCanonical: true,
    };
writeFileSync(resolve(finalDir, 'results.final.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(transitions.join('\n'));
