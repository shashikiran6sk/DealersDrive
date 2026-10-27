import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalUrl,
  parseUrls,
  normalize,
  validatePlan,
  galleryKey,
  inputKey,
  renderVehicle,
  mediaUrl,
  parseLoudness,
} from '../src/core.mjs';
import { get } from '../src/source.mjs';
import { validResult } from '../src/workflow.mjs';
import { vehicle, url } from './fixtures.mjs';
test('audio checks read loudness JSON with Linux FFmpeg summary lines after it', () => {
  const report = { input_i: '-13.89', input_tp: '-1.32', input_lra: '1.2' };
  const log =
    '[Parsed_loudnorm] ' +
    JSON.stringify(report) +
    '\n[out#0/null @ 0x1234] video:0KiB audio:15008KiB\n';
  assert.deepEqual(parseLoudness(log), report);
  assert.throws(() => parseLoudness('no measurement'));
  assert.throws(() => parseLoudness('{"input_i":"-inf","input_tp":"-inf","input_lra":"0"}'));
});
test('canonical URL intake normalizes tracking, commas, newlines and duplicate links', () => {
  assert.deepEqual(
    parseUrls([
      url('fixture-car') + '?utm_source=test,\n' + url('fixture-car') + '/',
      url('second'),
    ]),
    [url('fixture-car'), url('second')],
  );
  assert.equal(canonicalUrl('https://dealers-drive.com/car/fixture-car'), url('fixture-car'));
});
test('unsupported targets are rejected before network access', () => {
  for (const u of [
    'http://www.dealers-drive.com/car/a',
    'https://example.com/car/a',
    'https://www.dealers-drive.com/dealers/a',
    'https://www.dealers-drive.com:3000/car/a',
    'https://me:secret@www.dealers-drive.com/car/a',
    'file:///tmp/a',
    'https://www.dealers-drive.com/car/a/../b',
  ])
    assert.throws(() => canonicalUrl(u));
  assert.throws(() => mediaUrl('https://localhost/photo.png'));
});
test('manufacturing year wins over later registration year', () => {
  const c = normalize(vehicle(), url('fixture-car'));
  assert.equal(c.facts.year, 2018);
  assert.equal(c.facts.priceDisplay, '₹7.50 lakh');
  assert.equal(c.facts.kilometres, '1,23,456 km');
});
test('reserved, sold and withdrawn vehicles do not become available-car ads', () => {
  for (const availability of ['RESERVED', 'SOLD', 'WITHDRAWN'])
    assert.throws(
      () => normalize(vehicle('fixture-car', { availability }), url('fixture-car')),
      (e) => e.code === 'UNAVAILABLE',
    );
});
test('missing optional facts do not fabricate price, owner or kilometres', () => {
  const raw = vehicle();
  raw.facts = { model: 'Known model' };
  raw.priceLabel = null;
  raw.year = null;
  raw.specs = [];
  const c = normalize(raw, url('fixture-car'));
  assert.equal(c.facts.priceDisplay, 'Price on request');
  assert.equal(c.facts.owners, '');
  assert.equal(c.facts.kilometres, '');
  assert.equal(c.facts.year, '');
});
test('conflicting source identity, year and price are rejected', () => {
  assert.throws(() => normalize(vehicle(), url('another')));
  assert.throws(() => normalize(vehicle('fixture-car', { year: 2020 }), url('fixture-car')));
  assert.throws(() =>
    normalize(vehicle('fixture-car', { priceLabel: '₹8,00,000' }), url('fixture-car')),
  );
});
test('exact rupee price is used when lakh rounding would lose information', () => {
  const raw = vehicle();
  raw.facts.pricePaise = 75012300;
  raw.priceLabel = '₹7,50,123';
  assert.equal(normalize(raw, url(raw.slug)).facts.priceDisplay, '₹7,50,123');
});
function capture() {
  const c = normalize(vehicle(), url('fixture-car'));
  c.images = c.images.map((p, i) => ({
    ...p,
    hash: String(i + 1).repeat(64),
    file: String(i + 1) + '.png',
  }));
  return c;
}
test('photo choices belong to this gallery and cache survives gallery reordering', () => {
  const c = capture(),
    plan = { hero: c.images[0].hash, dashboard: c.images[2].hash };
  validatePlan(plan, c);
  assert.throws(() => validatePlan({ hero: 'unrelated' }, c));
  assert.throws(() => validatePlan({ ...plan, engine: c.images[0].hash }, c));
  const reordered = {
    ...c,
    images: [c.images[2], c.images[1], c.images[0], c.images[3]],
    primaryIndex: 2,
  };
  assert.equal(galleryKey(c), galleryKey(reordered));
  assert.equal(inputKey(c, plan, 'style'), inputKey(reordered, plan, 'style'));
});
test('render fingerprints invalidate on price, media choice or style change', () => {
  const c = capture(),
    p = { hero: c.images[0].hash },
    k = inputKey(c, p, 'style');
  assert.notEqual(
    inputKey({ ...c, facts: { ...c.facts, priceLabel: '₹8,00,000' } }, p, 'style'),
    k,
  );
  assert.notEqual(inputKey(c, { hero: c.images[1].hash }, 'style'), k);
  assert.notEqual(inputKey(c, p, 'new-style'), k);
});
test('sparse galleries repeat actual selected views without inventing cabin coverage', () => {
  const c = capture(),
    p = { hero: c.images[0].hash },
    car = renderVehicle(c, p);
  assert.equal(car.photos.side, c.images[0].file);
  assert.equal(car.photos.dashboard, undefined);
});
test('cache receipts cannot substitute a vertical file for a horizontal request', () => {
  const r = {
    verified: true,
    inputKey: 'k',
    car: 'c',
    format: 'vertical',
    width: 1080,
    height: 1920,
    fps: 60,
    frames: 1200,
    duration: 20,
  };
  assert.ok(validResult(r, 'c', 'vertical', 'k'));
  assert.ok(!validResult(r, 'c', 'horizontal', 'k'));
  assert.ok(!validResult({ ...r, frames: 1 }, 'c', 'vertical', 'k'));
});
test('public reads are GET-only and do not follow redirects to other hosts', async () => {
  let calls = 0;
  await assert.rejects(() =>
    get('https://api.dealers-drive.com/v1/vehicles/a', {
      fetcher: async (u, o) => {
        calls++;
        assert.equal(o.method, 'GET');
        return new Response(null, {
          status: 302,
          headers: { location: 'https://other.example/private' },
        });
      },
    }),
  );
  assert.equal(calls, 1);
});
test('transient public-source errors have a bounded retry', async () => {
  let calls = 0;
  await assert.rejects(() =>
    get('https://api.dealers-drive.com/v1/vehicles/a', {
      fetcher: async () => {
        calls++;
        return new Response('temporary', { status: 503 });
      },
    }),
  );
  assert.equal(calls, 2);
});
