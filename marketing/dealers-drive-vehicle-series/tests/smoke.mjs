import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Workflow, ROOT, read, write } from '../src/workflow.mjs';
import { doctor } from '../src/media.mjs';
import { fixture, url } from './fixtures.mjs';

await doctor();
const parent = path.join(ROOT, 'runs');
await fs.mkdir(parent, { recursive: true });
const temp = await fs.mkdtemp(path.join(parent, 'smoke-')),
  fixtures = path.join(temp, 'fixtures');
await fixture(fixtures);
const w = new Workflow({ runs: path.join(temp, 'jobs with spaces'), fixture: fixtures });
const single = await w.prepare([url('fixture-car-1')]);
await w.select(single.job, null, { hero: 1, rear: 2, dashboard: 3, frontSeats: 4 });
await w.preview(single.job);
const first = await w.render(single.job);
assert.equal(first.results.length, 2);
assert.ok(first.results.every((r) => r.verified && r.frames === 1200));
const firstDelivery = await w.deliver(single.job);
assert.equal(firstDelivery.files.length, 2);
assert.deepEqual(firstDelivery.archives, []);
const horizontal = first.results.find((r) => r.format === 'horizontal');
await fs.unlink(path.join(single.directory, horizontal.file));
await fs.unlink(path.join(single.directory, 'results', 'fixture-car-1-horizontal.json'));
const repaired = await w.render(single.job);
assert.ok(repaired.results.every((r) => r.reused));
assert.deepEqual(
  repaired.results.map((r) => r.sha256).sort(),
  first.results.map((r) => r.sha256).sort(),
);
const repeated = await w.prepare([url('fixture-car-1')]);
assert.equal(repeated.cars[0].needsSelection, false);
await w.preview(repeated.job);
assert.ok((await w.render(repeated.job)).results.every((r) => r.reused));
const multi = await w.prepare([url('fixture-car-1'), url('fixture-car-2')]);
await w.select(multi.job, 'fixture-car-2', { hero: 1, rear: 2 });
await w.preview(multi.job);
const rendered = await w.render(multi.job);
assert.equal(rendered.results.length, 4);
assert.equal(rendered.results.filter((r) => r.reused).length, 2);
const delivered = await w.deliver(multi.job);
assert.equal(delivered.files.length, 4);
assert.equal(delivered.archives.length, 3);
const f = await read(path.join(fixtures, 'fixture.json'));
f.listings[url('fixture-car-2')].vehicle.facts.pricePaise = 90000000;
f.listings[url('fixture-car-2')].vehicle.priceLabel = '₹9,00,000';
await write(path.join(fixtures, 'fixture.json'), f);
await assert.rejects(
  () => w.deliver(multi.job),
  (e) => e.code === 'STALE',
);
const artifacts = path.join(ROOT, 'runs/ci-artifacts');
await fs.mkdir(artifacts, { recursive: true });
for (const file of delivered.files)
  await fs.copyFile(file.path, path.join(artifacts, path.basename(file.path)));
for (const proof of (await read(path.join(multi.directory, 'preview.json'))).proofs)
  await fs.copyFile(proof.path, path.join(artifacts, path.basename(proof.path)));
await write(path.join(artifacts, 'verification.json'), {
  fixture: true,
  checks: [
    'single URL → two files',
    'two URLs → four files',
    'missing optional data/interiors',
    'long title layout',
    'completed orientation preserved on recovery',
    'unchanged data reuses verified cache',
    'changed price blocks delivery',
  ],
  results: rendered.results,
});
console.log(
  JSON.stringify(
    { passed: true, directory: temp, artifactDirectory: artifacts, uniqueMovies: 4 },
    null,
    2,
  ),
);
