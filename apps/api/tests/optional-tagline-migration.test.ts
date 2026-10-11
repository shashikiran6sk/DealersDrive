import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';

const NAME = '20261010093000_optional_tagline';
const DIRECTORY = join(import.meta.dirname, '../prisma/migrations');
const DATABASE = 'dealersdrive_test_tagline_migration';
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

describe('optional tagline migration', () => {
  it('preserves live values and distinguishes historical replacements from services-only proposals', async () => {
    const ids: string[] = [];
    for (const [tagline, status] of [
      ['Old proposed line', 'PENDING'],
      [null, 'PENDING'],
      ['Rejected proposed line', 'REJECTED'],
    ] as const) {
      const dealer = randomUUID(),
        id = randomUUID();
      ids.push(id);
      await db.query(
        'INSERT INTO dealers (id, slug, "brandName", "legalName", tagline) VALUES ($1, $2, $2, $2, $3)',
        [dealer, `tagline-migration-${dealer}`, 'Preserved live line'],
      );
      await db.query(
        'INSERT INTO dealer_profile_changes (id, "dealerId", status, tagline, specialities) VALUES ($1, $2, $3::"ProfileChangeStatus", $4, $5)',
        [id, dealer, status, tagline, ['Finance']],
      );
    }
    await db.query(sql(NAME));
    const rows = await db.query(
      'SELECT id, status, tagline, "taglineChanged" FROM dealer_profile_changes',
    );
    expect(rows.rows.find((row) => row.id === ids[0])).toMatchObject({
      status: 'PENDING',
      tagline: 'Old proposed line',
      taglineChanged: true,
    });
    expect(rows.rows.find((row) => row.id === ids[1])).toMatchObject({
      status: 'PENDING',
      tagline: null,
      taglineChanged: false,
    });
    expect(rows.rows.find((row) => row.id === ids[2])).toMatchObject({
      status: 'REJECTED',
      tagline: 'Rejected proposed line',
      taglineChanged: true,
    });
    expect(
      (await db.query('SELECT tagline FROM dealers')).rows.every(
        (row) => row.tagline === 'Preserved live line',
      ),
    ).toBe(true);
  });
});
