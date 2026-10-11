import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';

const NAME = '20261010150000_dealer_verification';
const DIRECTORY = join(import.meta.dirname, '../prisma/migrations');
const DATABASE = 'dealersdrive_test_dealer_verification_migration';
let db: pg.Client;

function sql(name: string) {
  return readFileSync(join(DIRECTORY, name, 'migration.sql'), 'utf8');
}

beforeEach(async () => {
  if (db) await db.end();
  const url = new URL(env.DATABASE_URL);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/dealersdrive_test') {
    throw new Error('Migration rehearsal requires the isolated local test database.');
  }
  url.pathname = '/dealersdrive';
  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${DATABASE}`);
  await admin.query(`CREATE DATABASE ${DATABASE}`);
  await admin.end();
  url.pathname = `/${DATABASE}`;
  db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  for (const name of readdirSync(DIRECTORY)
    .filter((n) => /^\d{14}_/.test(n) && n < NAME)
    .sort()) {
    await db.query(sql(name));
  }
}, 120_000);

afterAll(async () => {
  if (db) await db.end();
});

async function legacy(status = 'ACTIVE') {
  const id = randomUUID();
  await db.query(
    'INSERT INTO dealers (id,slug,"brandName","legalName",status) VALUES ($1,$2,$3,$3,$4)',
    [id, 'verification-' + id, 'Synthetic legacy business', status],
  );
  return id;
}
describe('additive dealer verification migration', () => {
  it('does not fabricate verification or deactivate approved legacy businesses', async () => {
    const ids = await Promise.all(
      ['ACTIVE', 'SUSPENDED', 'DRAFT', 'PENDING_APPROVAL'].map((status) => legacy(status)),
    );
    const before = await db.query('SELECT id,status,"legalName" FROM dealers ORDER BY id');
    await db.query(sql(NAME));
    expect((await db.query('SELECT id,status,"legalName" FROM dealers ORDER BY id')).rows).toEqual(
      before.rows,
    );
    const after = await db.query(
      'SELECT "verificationStatus","verificationVersion","verificationVerifiedAt","verificationReviewerId" FROM dealers WHERE id=ANY($1::uuid[])',
      [ids],
    );
    expect(
      after.rows.every(
        (row) =>
          row.verificationStatus === 'NOT_VERIFIED' &&
          row.verificationVersion === 0 &&
          row.verificationVerifiedAt === null &&
          row.verificationReviewerId === null,
      ),
    ).toBe(true);
  });
  it('enforces stored proof and version constraints on a clean database', async () => {
    await db.query(sql(NAME));
    const id = await legacy();
    await expect(
      db.query(`UPDATE dealers SET "verificationStatus"='VERIFIED' WHERE id=$1`, [id]),
    ).rejects.toThrow(/check constraint/);
    await expect(
      db.query('UPDATE dealers SET "verificationVersion"=-1 WHERE id=$1', [id]),
    ).rejects.toThrow(/check constraint/);
    await db.query(
      `UPDATE dealers SET "verificationStatus"='VERIFIED',"verificationReviewerId"=$2,"verificationVerifiedAt"=now() WHERE id=$1`,
      [id, randomUUID()],
    );
    expect(
      (await db.query('SELECT "verificationStatus" FROM dealers WHERE id=$1', [id])).rows[0]
        .verificationStatus,
    ).toBe('VERIFIED');
  });
  it('transactional rollback preserves original dealers before rollout', async () => {
    const id = await legacy();
    const migration = sql(NAME).replace(/COMMIT;\s*$/, 'ROLLBACK;');
    await db.query(migration);
    expect((await db.query('SELECT status FROM dealers WHERE id=$1', [id])).rows[0].status).toBe(
      'ACTIVE',
    );
    const cols = await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='dealers' AND column_name='verificationStatus'",
    );
    expect(cols.rows).toHaveLength(0);
  });
});
