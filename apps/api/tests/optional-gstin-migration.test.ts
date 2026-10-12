import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';

const NAME = '20261010153000_optional_gstin';
const DIRECTORY = join(import.meta.dirname, '../prisma/migrations');
const DATABASE = 'dealersdrive_test_optional_gstin_migration';
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

async function legacy(value: string | null) {
  const id = randomUUID();
  await db.query(
    `INSERT INTO dealers (id,slug,"brandName","legalName",gstin,status) VALUES ($1,$2,$3,$3,$4,'ACTIVE')`,
    [id, 'gstin-' + id, 'Synthetic ' + id, value],
  );
  return id;
}
describe('optional GSTIN safe migration', () => {
  it('normalizes valid legacy casing/ASCII whitespace and blank values without disabling records', async () => {
    const ids = await Promise.all([legacy(' 33aabcs1429p1zv '), legacy(' \t\n '), legacy(null)]);
    await db.query(sql(NAME));
    const r = await db.query(
      'SELECT id,status,gstin FROM dealers WHERE id=ANY($1::uuid[]) ORDER BY id',
      [ids],
    );
    expect(r.rows.find((row) => row.id === ids[0]).gstin).toBe('33AABCS1429P1ZV');
    expect(r.rows.filter((row) => row.id !== ids[0]).every((row) => row.gstin === null)).toBe(true);
    expect(r.rows.every((row) => row.status === 'ACTIVE')).toBe(true);
  });
  it('aborts duplicate canonical identities and preserves every old value', async () => {
    await legacy('33AABCS1429P1Z5');
    await legacy(' 33aabcs1429p1z5 ');
    const before = (await db.query('SELECT id,gstin FROM dealers ORDER BY id')).rows;
    await expect(db.query(sql(NAME))).rejects.toThrow(/preflight failed/);
    await db.query('ROLLBACK');
    expect((await db.query('SELECT id,gstin FROM dealers ORDER BY id')).rows).toEqual(before);
  });
  it('aborts invalid legacy values without silently clearing an identity', async () => {
    const id = await legacy('legacy-invalid');
    await expect(db.query(sql(NAME))).rejects.toThrow(/invalid legacy values/);
    await db.query('ROLLBACK');
    expect((await db.query('SELECT gstin FROM dealers WHERE id=$1', [id])).rows[0].gstin).toBe(
      'legacy-invalid',
    );
  });
  it('enforces format and uniqueness while multiple nulls remain legitimate', async () => {
    await db.query(sql(NAME));
    await legacy(null);
    await legacy(null);
    await legacy('33AABCS1429P1Z5');
    await expect(legacy('33AABCS1429P1Z5')).rejects.toThrow(/unique constraint/);
    await expect(legacy('33aabcs1429p1z5')).rejects.toThrow(/check constraint/);
    await expect(legacy('bad')).rejects.toThrow(/check constraint/);
  });
  it('supports pre-rollout rollback with original values retained', async () => {
    const id = await legacy(' 33aabcs1429p1z5 ');
    await db.query(sql(NAME).replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    expect((await db.query('SELECT gstin FROM dealers WHERE id=$1', [id])).rows[0].gstin).toBe(
      ' 33aabcs1429p1z5 ',
    );
  });
});
