import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Workflow, ROOT, read, write } from '../src/workflow.mjs';
import { fixture, url } from './fixtures.mjs';
async function setup(t, count = 2) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'dd-promo-test-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const fixtures = path.join(temp, 'fixtures');
  await fixture(fixtures, count);
  return {
    temp,
    fixtures,
    w: new Workflow({ root: ROOT, runs: path.join(temp, 'runs'), fixture: fixtures }),
  };
}
test('URL-only preparation creates distinct jobs and truthful optional data without network', async (t) => {
  const { w } = await setup(t),
    a = await w.prepare([url('fixture-car-1'), url('fixture-car-2'), url('fixture-car-1')]),
    b = await w.prepare([url('fixture-car-1')]);
  assert.equal(a.cars.length, 2);
  assert.notEqual(a.job, b.job);
  assert.equal(a.cars[0].needsSelection, true);
  assert.equal((await w.job(a.job)).job.cars[1].facts.priceDisplay, 'Price on request');
});
test('reserved member is reported while eligible batch member continues', async (t) => {
  const { w, fixtures } = await setup(t);
  const f = await read(path.join(fixtures, 'fixture.json'));
  f.listings[url('fixture-car-2')].vehicle.availability = 'RESERVED';
  await write(path.join(fixtures, 'fixture.json'), f);
  const p = await w.prepare([url('fixture-car-1'), url('fixture-car-2')]);
  assert.equal(p.cars.length, 1);
  assert.equal(p.skipped.length, 1);
  assert.equal(p.errors.length, 0);
});
test('selection is stored by image identity and reused after reordered gallery', async (t) => {
  const { w, fixtures } = await setup(t, 1),
    p = await w.prepare([url('fixture-car-1')]);
  await w.select(p.job, null, { hero: 1, front: 2, dashboard: 3, frontSeats: 4 });
  const old = (await w.load(p.job)).plan.cars['fixture-car-1'];
  const f = await read(path.join(fixtures, 'fixture.json')),
    raw = f.listings[url('fixture-car-1')].vehicle;
  raw.images = [raw.images[2], raw.images[1], raw.images[0], raw.images[3]];
  raw.primaryIndex = 2;
  await write(path.join(fixtures, 'fixture.json'), f);
  const q = await w.prepare([url('fixture-car-1')]);
  assert.equal(q.cars[0].needsSelection, false);
  assert.deepEqual((await w.load(q.job)).plan.cars['fixture-car-1'], old);
});
test('captured data/photo tampering fails before rendering', async (t) => {
  const { w } = await setup(t, 1),
    p = await w.prepare([url('fixture-car-1')]);
  await w.select(p.job, null, { hero: 1 });
  const { dir, job } = await w.job(p.job);
  await fs.appendFile(path.join(dir, 'media', job.cars[0].images[0].file), 'tampered');
  await assert.rejects(
    () => w.load(p.job),
    (e) => e.code === 'SOURCE_CHANGED',
  );
});
test('jobs cannot escape the run directory or accept stale preview plans', async (t) => {
  const { w } = await setup(t, 1);
  await assert.rejects(
    () => w.job('../outside'),
    (e) => e.code === 'PATH',
  );
  const p = await w.prepare([url('fixture-car-1')]);
  await w.select(p.job, null, { hero: 1 });
  await assert.rejects(
    () => w.render(p.job),
    (e) => e.code === 'NEEDS_PREVIEW',
  );
});
