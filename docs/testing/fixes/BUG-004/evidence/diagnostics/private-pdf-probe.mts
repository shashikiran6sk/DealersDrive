import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

import { env } from '../../../../../../apps/api/src/config/env.js';
import { documentKey } from '../../../../../../apps/api/src/modules/dealers/dealer-storage-keys.js';
import { createLocalStorage } from '../../../../../../apps/api/src/platform/storage/local.adapter.js';

const require = createRequire(new URL('../../../../../../apps/api/package.json', import.meta.url));
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const db = new URL(env.DATABASE_URL);
assert.equal(db.pathname, '/dealersdrive_cert');
assert.ok(['localhost', '127.0.0.1'].includes(db.hostname));
assert.equal(env.NODE_ENV, 'test');
assert.equal(env.STORAGE_DRIVER, 'local');
const api = new URL(env.API_BASE_URL);
assert.ok(['localhost', '127.0.0.1'].includes(api.hostname));
const fixture = JSON.parse(await readFile('/tmp/dd-bug004-browser-private.json', 'utf8'));
const owner = fixture.cases[0];
assert.ok(owner);
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
const pdf = await readFile(new URL('../../../BUG-002/browser-document.pdf', import.meta.url));
const headers = { Cookie: `dd_session=${owner.ownerToken}`, 'Content-Type': 'application/json' };
try {
  const presigned = await fetch(new URL('/v1/dealer/documents/presign', api), { method: 'POST', headers, body: JSON.stringify({ type: 'PAN_CARD', fileName: 'inert-mime-fixture.pdf', mimeType: 'application/pdf', bytes: pdf.length }) });
  assert.equal(presigned.status, 201);
  const input = await presigned.json();
  const upload = new URL(input.uploadUrl);
  assert.equal(upload.origin, api.origin);
  const uploaded = await fetch(upload, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: pdf });
  assert.equal(uploaded.status, 200);
  const committed = await fetch(new URL('/v1/dealer/documents/PAN_CARD/commit', api), { method: 'POST', headers, body: JSON.stringify({ documentId: input.documentId }) });
  assert.equal(committed.status, 200);
  const row = await prisma.dealerDocument.findUniqueOrThrow({ where: { id: input.documentId } });
  assert.equal(row.dealerId, owner.dealerId);
  assert.equal(row.status, 'UPLOADED');
  const signed = new URL(await createLocalStorage().signedReadUrl(documentKey(owner.slug, 'PAN_CARD', row.id), 300));
  const read = await fetch(signed);
  assert.equal(read.status, 200);
  assert.deepEqual(Buffer.from(await read.arrayBuffer()), pdf);
  const result = { bug: 'BUG-NEW-008', severity: 'P2', affectedArea: 'local private KYC PDF preview content type', reproduced: true, sourceEquivalentCommit: process.env.TESTED_SHA, result: 'FAIL reproduced', uploadContentType: 'application/pdf', signedReadContentType: read.headers.get('content-type'), privateCacheControl: read.headers.get('cache-control'), validPdfBytesPreserved: true, databaseDocumentStatus: row.status, ownershipVerified: true, scope: 'actual local-storage presign/PUT/commit/signed-read flow; deployed S3/R2 behavior not tested', rootCause: 'UUID-ended document keys have no extension; local adapter discards declared MIME metadata and private delivery infers a default JPEG from the key', disposition: 'Separate later layer; no private MIME fix in BUG-004' };
  assert.match(result.signedReadContentType ?? '', /^image\/jpeg/);
  await writeFile(new URL('../private-pdf-finding.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally {
  await prisma.$disconnect();
}
