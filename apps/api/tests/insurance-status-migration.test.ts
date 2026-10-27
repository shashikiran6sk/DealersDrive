import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';

const NAME = '20261023100000_insurance_status';
const DIRECTORY = join(import.meta.dirname, '../prisma/migrations');
const DATABASE = 'dealersdrive_test_insurance_status_migration';
let db: pg.Client;
let dealerId: string;
let count = 0;
const sql = (name: string) => readFileSync(join(DIRECTORY, name, 'migration.sql'), 'utf8');

beforeAll(async () => {
  const url = new URL(env.DATABASE_URL);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/dealersdrive_test')
    throw new Error('Migration rehearsal requires the isolated local test database.');
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
    .filter((name) => /^\d{14}_/.test(name) && name < NAME)
    .sort())
    await db.query(sql(name));
  dealerId = randomUUID();
  await db.query(
    'INSERT INTO dealers (id,slug,"brandName","legalName",status) VALUES ($1,$2,$3,$3,\'ACTIVE\')',
    [dealerId, `insurance-${dealerId}`, 'Synthetic migration business'],
  );
}, 120000);
afterAll(async () => {
  if (db) await db.end();
});

async function legacy(type: string | null, offset: number | null) {
  count += 1;
  const id = randomUUID();
  await db.query(
    `INSERT INTO vehicles (id,"dealerId","registrationNumber","updatedAt","insuranceType","insuranceValidUntil") VALUES ($1,$2,$3,now(),$4,CASE WHEN $5::int IS NULL THEN NULL ELSE (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + $5::int END)`,
    [id, dealerId, `TN22IM${2000 + count}`, type, offset],
  );
  return id;
}

describe('legacy insurance conversion on a populated database', () => {
  it('rolls back the enum conversion and preserves every historical field', async () => {
    const id = await legacy('THIRD_PARTY', 1);
    const before = (await db.query('SELECT * FROM vehicles WHERE id=$1', [id])).rows;
    await db.query(sql(NAME).replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    expect((await db.query('SELECT * FROM vehicles WHERE id=$1', [id])).rows).toEqual(before);
    await db.query('UPDATE vehicles SET "insuranceType"=\'COMPREHENSIVE\' WHERE id=$1', [id]);
  });
  it('converts both coverage types at date boundaries, preserves None, flags unknowns and retains historical dates', async () => {
    const cases: [string | null, number | null, string | null][] = [
      ['COMPREHENSIVE', 1, 'LIVE'],
      ['THIRD_PARTY', 1, 'LIVE'],
      ['COMPREHENSIVE', 0, 'LIVE'],
      ['THIRD_PARTY', 0, 'LIVE'],
      ['COMPREHENSIVE', -1, 'NONE'],
      ['THIRD_PARTY', -1, 'NONE'],
      ['COMPREHENSIVE', null, null],
      ['THIRD_PARTY', null, null],
      ['NONE', null, 'NONE'],
      ['NONE', 1, 'NONE'],
      ['NONE', -1, 'NONE'],
      [null, 1, null],
      [null, null, null],
    ];
    const ids = [];
    for (const [type, offset] of cases) ids.push(await legacy(type, offset));
    const before = (
      await db.query(
        'SELECT id,"insuranceValidUntil","registrationNumber","dealerId" FROM vehicles ORDER BY id',
      )
    ).rows;
    await db.query(sql(NAME));
    expect(
      (
        await db.query(
          'SELECT id,"insuranceValidUntil","registrationNumber","dealerId" FROM vehicles ORDER BY id',
        )
      ).rows,
    ).toEqual(before);
    for (const [index, id] of ids.entries())
      expect(
        (await db.query('SELECT "insuranceType" FROM vehicles WHERE id=$1', [id])).rows[0]
          .insuranceType,
      ).toBe(cases[index]?.[2]);
    expect(
      (
        await db.query(
          'SELECT enumlabel FROM pg_enum WHERE enumtypid=\'"InsuranceType"\'::regtype ORDER BY enumsortorder',
        )
      ).rows.map((row) => row.enumlabel),
    ).toEqual(['NONE', 'LIVE']);
    await expect(
      db.query('UPDATE vehicles SET "insuranceType"=\'COMPREHENSIVE\' WHERE id=$1', [ids[0]]),
    ).rejects.toThrow(/invalid input value/);
  });
});
