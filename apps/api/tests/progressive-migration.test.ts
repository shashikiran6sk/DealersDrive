import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
const name = 'dealersdrive_progressive_migration';
const migration = '20261011020000_progressive_onboarding';
const directory = join(import.meta.dirname, '../prisma/migrations');
let db: pg.Client;
beforeAll(async () => {
  const admin = new pg.Client({
    connectionString: 'postgresql://dealersdrive:dealersdrive@localhost:5432/dealersdrive',
  });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${name}`);
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  db = new pg.Client({
    connectionString: `postgresql://dealersdrive:dealersdrive@localhost:5432/${name}`,
  });
  await db.connect();
  for (const entry of readdirSync(directory)
    .filter((entry) => /^\d{14}_/.test(entry) && entry < migration)
    .sort())
    await db.query(readFileSync(join(directory, entry, 'migration.sql'), 'utf8'));
  await db.query(
    `INSERT INTO dealers (id,slug,"brandName","legalName",status) VALUES ('11111111-1111-4111-8111-111111111111','synthetic-legacy','Synthetic Legacy','Synthetic Legacy','ACTIVE')`,
  );
  await db.query(readFileSync(join(directory, migration, 'migration.sql'), 'utf8'));
}, 120000);
afterAll(async () => {
  await db.end();
});
it('preserves existing active dealers without requiring automatic reverification', async () => {
  const row = (
    await db.query(
      'SELECT status,"progressiveRegisteredAt","progressiveConsentVersion","progressiveVersion" FROM dealers',
    )
  ).rows[0];
  expect(row).toEqual({
    status: 'ACTIVE',
    progressiveRegisteredAt: null,
    progressiveConsentVersion: null,
    progressiveVersion: 0,
  });
});
it('enforces paired registration timestamp and consent version', async () => {
  await expect(
    db.query(`UPDATE dealers SET "progressiveRegisteredAt"=now()`),
  ).rejects.toMatchObject({ code: '23514' });
});
it('enforces a nonnegative concurrency version', async () => {
  await expect(db.query(`UPDATE dealers SET "progressiveVersion"=-1`)).rejects.toMatchObject({
    code: '23514',
  });
});
it('accepts progressive state without changing existing ownership or business status', async () => {
  await db.query(
    `UPDATE dealers SET "progressiveRegisteredAt"=now(),"progressiveConsentVersion"='synthetic-consent'`,
  );
  expect((await db.query('SELECT status FROM dealers')).rows[0]?.status).toBe('ACTIVE');
});
