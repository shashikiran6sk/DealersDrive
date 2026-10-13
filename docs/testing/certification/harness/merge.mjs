// Merge every per-area results file into registry/results.json, then print the
// Part X tally. Later-written area files win on duplicate ids (by mtime).
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REG = resolve(here, '..', 'registry');
const DIR = resolve(REG, 'results');
const OUT = resolve(REG, 'results.json');
const STATUSES = ['PASS', 'FAIL', 'BLOCKED', 'NOT_APPLICABLE'];

const files = existsSync(DIR)
  ? readdirSync(DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => resolve(DIR, f))
      .sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs)
  : [];
const merged = {};
for (const f of files) {
  const data = JSON.parse(readFileSync(f, 'utf8'));
  for (const [id, rec] of Object.entries(data)) merged[id] = rec;
}
writeFileSync(OUT, `${JSON.stringify(merged, null, 2)}\n`);

const { scenarios } = JSON.parse(readFileSync(resolve(REG, 'registry.json'), 'utf8'));
const tally = Object.fromEntries(STATUSES.map((s) => [s, 0]));
let missing = 0;
const missingIds = [];
for (const s of scenarios) {
  const st = merged[s.id]?.status;
  if (!st) {
    missing += 1;
    missingIds.push(s.id);
  } else if (STATUSES.includes(st)) tally[st] += 1;
}
const unknown = Object.keys(merged).filter((id) => !scenarios.some((s) => s.id === id));
console.log(
  'canonical tally:',
  JSON.stringify(tally),
  'missing',
  missing,
  'unknown-ids',
  unknown.length,
);
if (unknown.length) console.log('UNKNOWN IDS (not in registry):', unknown.join(', '));
if (process.argv[2] === '--missing' && missing) {
  const bySec = {};
  for (const id of missingIds) {
    const sec = id.replace(/-\d+$/, '');
    (bySec[sec] ??= []).push(id);
  }
  for (const [sec, ids] of Object.entries(bySec))
    console.log(
      `  ${sec}: ${ids.length} (${ids.slice(0, 3).join(', ')}${ids.length > 3 ? '…' : ''})`,
    );
}
