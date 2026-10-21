// Performance smoke: latency distribution of the public API and web pages on this machine,
// sequential (one client) and at a fixed concurrency. It measures this container — one API
// process, one Next.js process, local PostgreSQL — and is not a production capacity claim.
import { cpus, totalmem } from 'node:os';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import * as h from './lib.mjs';

const WEB = process.env.CERT_WEB ?? 'http://localhost:3000';
const SAMPLES = Number(process.env.CERT_PERF_SAMPLES ?? 60);
const CONCURRENCY = Number(process.env.CERT_PERF_CONCURRENCY ?? 10);

const car = await h.one(
  `SELECT l.slug FROM listings l JOIN dealers d ON d.id=l."dealerId" WHERE l.status='ACTIVE' AND d.status='ACTIVE' AND l.slug IS NOT NULL ORDER BY l."createdAt" LIMIT 1`,
);
const dealer = await h.one(
  `SELECT slug FROM dealers WHERE status='ACTIVE' ORDER BY "createdAt" LIMIT 1`,
);
const buyer = await h.customer('Perf Buyer');

const TARGETS = [
  ['API GET /v1/vehicles', `${h.API}/v1/vehicles?limit=24`],
  ['API GET /v1/vehicles filtered', `${h.API}/v1/vehicles?limit=24&fuel=diesel&sort=price_asc`],
  ['API GET /v1/vehicles/:slug', `${h.API}/v1/vehicles/${car.slug}`],
  ['API GET /v1/dealers', `${h.API}/v1/dealers?limit=24`],
  ['API GET /v1/dealers/:slug', `${h.API}/v1/dealers/${dealer.slug}`],
  ['API GET /v1/enquiries (signed in)', `${h.API}/v1/enquiries`, buyer.cookie],
  ['WEB GET /', `${WEB}/`],
  ['WEB GET /cars', `${WEB}/cars`],
  ['WEB GET /cars?q=Creta', `${WEB}/cars?q=Creta`],
  ['WEB GET /car/:slug', `${WEB}/car/${car.slug}`],
  ['WEB GET /dealers/:slug', `${WEB}/dealers/${dealer.slug}`],
];

const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]);
};
async function hit(url, cookie) {
  const t = performance.now();
  const res = await fetch(url, { headers: cookie ? { cookie } : {} });
  await res.arrayBuffer();
  return { ms: performance.now() - t, status: res.status };
}
async function measure(url, cookie, concurrency) {
  const times = [];
  const statuses = {};
  await hit(url, cookie);
  let next = 0;
  const started = performance.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < SAMPLES) {
        next += 1;
        const x = await hit(url, cookie);
        times.push(x.ms);
        statuses[x.status] = (statuses[x.status] ?? 0) + 1;
      }
    }),
  );
  const seconds = (performance.now() - started) / 1000;
  return {
    n: times.length,
    p50: pct(times, 50),
    p95: pct(times, 95),
    p99: pct(times, 99),
    max: Math.round(Math.max(...times)),
    rps: Math.round((times.length / seconds) * 10) / 10,
    statuses,
  };
}

const rows = [];
for (const [label, url, cookie] of TARGETS) {
  const seq = await measure(url, cookie, 1);
  const conc = await measure(url, cookie, CONCURRENCY);
  rows.push({ label, sequential: seq, concurrent: conc });
  console.log(
    `${label.padEnd(36)} seq p50 ${seq.p50} p95 ${seq.p95} p99 ${seq.p99} | c${CONCURRENCY} p50 ${conc.p50} p95 ${conc.p95} p99 ${conc.p99} ${conc.rps} rps ${JSON.stringify(conc.statuses)}`,
  );
}
const out = {
  at: new Date().toISOString(),
  machine: {
    cpus: cpus().length,
    cpuModel: cpus()[0]?.model,
    memoryGiB: Math.round(totalmem() / 2 ** 30),
  },
  samplesPerCell: SAMPLES,
  concurrency: CONCURRENCY,
  note: 'Local container: one API process (tsx, development mode), one `next start` web process, local PostgreSQL 16 holding the campaign data. Warm cache after one priming request. Not a production capacity measurement.',
  rows,
};
const dir = resolve(h.CERT, 'EVIDENCE', 'performance');
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, 'latency.json'), `${JSON.stringify(out, null, 2)}\n`);
await h.pool.end();
