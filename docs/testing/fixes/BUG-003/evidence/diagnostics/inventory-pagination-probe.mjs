import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../../../../apps/api/package.json', import.meta.url));
const { Client } = require('pg');
const fixture = JSON.parse(await fs.readFile('/tmp/dd-bug003-browser-private.json', 'utf8'));
const database = new URL(process.env.DATABASE_URL);
assert.ok(['localhost', '127.0.0.1'].includes(database.hostname));
assert.equal(database.pathname, '/dealersdrive_cert');
const api = `http://localhost:${fixture.apiPort}`;
const db = new Client({ connectionString: database.toString() });
await db.connect();
const snapshot = await db.query('SELECT id,"createdAt" FROM vehicles WHERE "dealerId"=$1', [
  fixture.dealerId,
]);
assert.equal(snapshot.rowCount, 51);
const at = '2026-10-02T09:00:00.123Z';
try {
  await db.query('UPDATE vehicles SET "createdAt"=$1 WHERE "dealerId"=$2', [at, fixture.dealerId]);
  const expected = await db.query(
    'SELECT id FROM vehicles WHERE "dealerId"=$1 ORDER BY "createdAt" DESC,id DESC',
    [fixture.dealerId],
  );
  const visited = [],
    pages = [];
  let cursor;
  for (let n = 0; n < 55; n += 1) {
    const url = new URL('/v1/dealer/vehicles', api);
    url.searchParams.set('limit', '1');
    if (cursor) url.searchParams.set('cursor', cursor);
    const response = await fetch(url, { headers: { Cookie: `dd_session=${fixture.ownerToken}` } });
    assert.equal(response.status, 200);
    const page = await response.json();
    visited.push(...page.data.map((row) => row.id));
    pages.push({ rows: page.data.length, hasMore: page.page.hasMore });
    if (!page.page.hasMore) break;
    cursor = page.page.nextCursor;
    assert.ok(cursor);
  }
  assert.equal(visited.length, 1);
  assert.deepEqual(pages, [
    { rows: 1, hasMore: true },
    { rows: 0, hasMore: false },
  ]);
  const result = {
    bug: 'BUG-NEW-007',
    severity: 'P2',
    result: 'FAIL reproduced',
    affectedArea: 'dealer inventory pagination',
    testedSha: process.env.TESTED_SHA,
    endpoint: 'GET /v1/dealer/vehicles?limit=1',
    environment: 'isolated real-cookie API / PostgreSQL / inert published stock',
    databaseRows: expected.rowCount,
    visitedRows: visited.length,
    pages,
    rootCause:
      'inventory encodes only createdAt and queries strictly earlier dates while sorting createdAt/id',
    disposition: 'Recorded for a separate stacked fix; inventory source unchanged in BUG003',
  };
  await fs.writeFile(
    new URL('../inventory-pagination-finding.json', import.meta.url),
    JSON.stringify(result, null, 2) + '\n',
  );
  console.log(JSON.stringify(result));
} finally {
  for (const row of snapshot.rows)
    await db.query('UPDATE vehicles SET "createdAt"=$1 WHERE id=$2', [row.createdAt, row.id]);
  const restored = await db.query(
    'SELECT id,"createdAt" FROM vehicles WHERE "dealerId"=$1 ORDER BY id',
    [fixture.dealerId],
  );
  assert.deepEqual(
    restored.rows,
    snapshot.rows.sort((a, b) => a.id.localeCompare(b.id)),
  );
  await db.end();
}
