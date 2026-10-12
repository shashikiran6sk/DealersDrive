import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';

const NAME = '20261010090000_service_locations';
const DIRECTORY = join(import.meta.dirname, '../prisma/migrations');
const DATABASE = 'dealersdrive_test_location_migration';
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

async function legacy(state: string | null, district: string | null) {
  const id = randomUUID();
  await db.query(
    'INSERT INTO dealers (id, slug, "brandName", "legalName", state, district, city) VALUES ($1, $2, $2, $2, $3, $4, $5)',
    [id, `legacy-location-${id}`, state, district, 'Preserved Town'],
  );
  return id;
}

describe('service location migration: isolated scratch database', () => {
  it('migrates an empty database with exactly 36 states/UTs and all 38 Tamil Nadu districts', async () => {
    await db.query(sql(NAME));
    expect(
      (await db.query('SELECT count(*)::int AS count FROM service_states')).rows[0].count,
    ).toBe(36);
    expect(
      (
        await db.query(
          'SELECT count(*)::int AS count FROM service_states WHERE "onboardingEnabled"',
        )
      ).rows[0].count,
    ).toBe(1);
    expect(
      (
        await db.query(
          'SELECT count(*)::int AS count FROM service_districts WHERE "stateId" = $1 AND "onboardingEnabled"',
          ['IN-TN'],
        )
      ).rows[0].count,
    ).toBe(38);
  });
  it('backfills exact reviewed aliases while preserving ambiguous and out-of-state records for review', async () => {
    const known = await legacy('\tTN\n', '\t kanniyakumari \t');
    const ambiguous = await legacy('Tamilnadu', 'Vellor');
    const outside = await legacy('Karnataka', 'Dharwad');
    const blank = await legacy(null, null);
    await db.query(sql(NAME));
    const rows = await db.query(
      'SELECT id, state, district, city, "serviceStateId", "serviceDistrictId", "locationReviewRequired" FROM dealers',
    );
    expect(rows.rows.find((r) => r.id === known)).toMatchObject({
      state: 'Tamil Nadu',
      district: 'Kanyakumari',
      serviceStateId: 'IN-TN',
      serviceDistrictId: 'IN-TN-KANYAKUMARI',
      locationReviewRequired: false,
      city: 'Preserved Town',
    });
    expect(rows.rows.find((r) => r.id === ambiguous)).toMatchObject({
      state: 'Tamilnadu',
      district: 'Vellor',
      serviceStateId: null,
      serviceDistrictId: null,
      locationReviewRequired: true,
    });
    expect(rows.rows.find((r) => r.id === outside)).toMatchObject({
      state: 'Karnataka',
      district: 'Dharwad',
      serviceStateId: null,
      serviceDistrictId: null,
      locationReviewRequired: true,
    });
    expect(rows.rows.find((r) => r.id === blank)).toMatchObject({ locationReviewRequired: false });
    expect(rows.rowCount).toBe(4);
  });
  it('preserves vehicle and listing ownership through the additive migration', async () => {
    const dealer = await legacy('Tamil Nadu', 'Vellore');
    const vehicle = randomUUID(),
      listing = randomUUID();
    await db.query(
      'INSERT INTO vehicles (id, "dealerId", "registrationNumber", "updatedAt") VALUES ($1, $2, $3, now())',
      [vehicle, dealer, 'TN00QA4004'],
    );
    await db.query(
      'INSERT INTO listings (id, "vehicleId", "dealerId", slug, "updatedAt") VALUES ($1, $2, $3, $4, now())',
      [listing, vehicle, dealer, 'location-migration-qa'],
    );
    await db.query(sql(NAME));
    expect(
      (await db.query('SELECT "vehicleId", "dealerId" FROM listings WHERE id = $1', [listing]))
        .rows[0],
    ).toEqual({ vehicleId: vehicle, dealerId: dealer });
    await expect(
      db.query('UPDATE dealers SET "serviceStateId" = $1 WHERE id = $2', ['IN-KA', dealer]),
    ).rejects.toThrow(/foreign key constraint/);
    await expect(
      db.query('DELETE FROM service_districts WHERE id = $1', ['IN-TN-VELLORE']),
    ).rejects.toThrow(/foreign key constraint/);
  });
  it('builds the restricted history index concurrently over existing audit records', async () => {
    await db.query(sql(NAME));
    await db.query(`INSERT INTO audit_logs ("actorType", action, "entityType", "entityId", "after")
      VALUES ('SYSTEM', 'qa.location', 'ServiceState', 'IN-TN', '{"active":true}'::jsonb),
      ('SYSTEM', 'qa.unrelated', 'Dealer', 'synthetic', '{}'::jsonb)`);
    await db.query(sql('20261010090100_service_location_audit_index'));
    const result = await db.query(`SELECT i.indisvalid, pg_get_indexdef(i.indexrelid) AS definition
      FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
      WHERE c.relname = 'audit_logs_service_locations_history_idx'`);
    expect(result.rows[0].indisvalid).toBe(true);
    expect(result.rows[0].definition).toContain('ServiceDistrict');
    expect((await db.query('SELECT count(*)::int AS count FROM audit_logs')).rows[0].count).toBe(2);
  });
  it('rolls back atomically before commit and can be safely retried without losing original data', async () => {
    const id = await legacy('TN', 'Vellore');
    await db.query('BEGIN');
    await db.query(sql(NAME).replace('BEGIN;', '').replace('COMMIT;', ''));
    await db.query('ROLLBACK');
    expect(
      (await db.query("SELECT to_regclass('service_states') AS table")).rows[0].table,
    ).toBeNull();
    expect(
      (await db.query('SELECT state, district FROM dealers WHERE id = $1', [id])).rows[0],
    ).toEqual({ state: 'TN', district: 'Vellore' });
    await db.query(sql(NAME));
    expect(
      (await db.query('SELECT "serviceDistrictId" FROM dealers WHERE id = $1', [id])).rows[0]
        .serviceDistrictId,
    ).toBe('IN-TN-VELLORE');
  });
});
