// Final accounting after the production-readiness fix campaign: the previous
// final certification (retest/final/results.final.json, main f74401a) overlaid
// with the re-run on final main (retest/campaign-final/*.json). Each record
// keeps its baseline and previous-final status, so a FAIL a campaign PR fixed
// reads "FAIL → PASS", never a silent PASS.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CERT = resolve(here, '..');
const FINAL_SHA = process.env.CERT_FINAL_SHA ?? 'unknown';
const { scenarios } = JSON.parse(readFileSync(resolve(CERT, 'registry/registry.json'), 'utf8'));
const previous = JSON.parse(readFileSync(resolve(CERT, 'retest/final/results.final.json'), 'utf8'));
const dir = resolve(CERT, 'retest/campaign-final');
const latest = {};
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'results.campaign-final.json')) {
  Object.assign(latest, JSON.parse(readFileSync(resolve(dir, f), 'utf8')));
}
const FIXED_BY = {
  'BROWSER-009': '#248 (Admin dealer detail mobile overflow)',
  'DEALER-LIFE-017': '#249 (Close application; was NOT_APPLICABLE)',
};
const out = {};
const transitions = [];
const totals = { PASS: 0, FAIL: 0, BLOCKED: 0, NOT_APPLICABLE: 0 };
for (const s of scenarios) {
  const prev = previous[s.id];
  const now = latest[s.id];
  const rec = now ?? prev;
  if (!rec) continue;
  out[s.id] = {
    ...rec,
    baseline: prev?.baseline ?? 'NOT_RUN_AT_BASELINE',
    previousFinal: prev?.status ?? 'NONE',
    finalSource: now ? `re-run on final main ${FINAL_SHA}` : 'previous final (not re-runnable here)',
    ...(FIXED_BY[s.id] ? { fixedBy: FIXED_BY[s.id] } : {}),
  };
  totals[rec.status] = (totals[rec.status] ?? 0) + 1;
  if ((prev?.status ?? 'NONE') !== rec.status) transitions.push(`${s.id}: ${prev?.status ?? 'NONE'} → ${rec.status}${FIXED_BY[s.id] ? ` (${FIXED_BY[s.id]})` : ''}`);
}
const nonCanonical = Object.entries(latest)
  .filter(([id]) => !scenarios.some((s) => s.id === id))
  .map(([id, rec]) => ({ id, status: rec.status, note: rec.note }));
for (const n of nonCanonical) out[n.id] = { ...latest[n.id], nonCanonical: true };
writeFileSync(resolve(dir, 'results.campaign-final.json'), `${JSON.stringify(out, null, 2)}\n`);
const covered = scenarios.filter((s) => out[s.id]).length;
console.log(JSON.stringify({ canonical: scenarios.length, covered, totals, reRunNow: scenarios.filter((s) => latest[s.id]).length }, null, 1));
console.log('TRANSITIONS\n' + transitions.join('\n'));
console.log('NON-CANONICAL\n' + nonCanonical.map((n) => `${n.id} ${n.status}`).join('\n'));
