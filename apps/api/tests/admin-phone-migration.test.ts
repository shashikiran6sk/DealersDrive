import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';

const NAME = '20261010100000_admin_session_assurance';
const DIRECTORY = join(import.meta.dirname, '../prisma/migrations');
const DATABASE = 'dealersdrive_test_admin_phone_migration';
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

const CREDENTIALS = '20261010101000_admin_phone_credentials';
async function upgrade() {
  await db.query(sql(NAME));
  await db.query(sql(CREDENTIALS));
}
async function person() {
  const id = randomUUID();
  await db.query(
    'INSERT INTO users (id, "fullName", phone, "phoneVerifiedAt") VALUES ($1, $2, $3, now())',
    [id, 'Synthetic Legacy Administrator', '+919000007777'],
  );
  return id;
}
describe('admin phone migration rehearsal', () => {
  it('preserves legacy sessions and person phone data without automatically enrolling anyone', async () => {
    const userId = await person();
    for (const scope of ['ADMIN', 'CUSTOMER'])
      await db.query(
        'INSERT INTO sessions (id, "userId", "tokenHash", scope, "expiresAt") VALUES ($1, $2, $3, $4::"SessionScope", now() + interval $$1 hour$$)',
        [randomUUID(), userId, `synthetic-${scope}`, scope],
      );
    await upgrade();
    const sessions = (
      await db.query('SELECT scope, "authenticationMethod" FROM sessions ORDER BY scope')
    ).rows;
    expect(sessions).toEqual([
      { scope: 'ADMIN', authenticationMethod: null },
      { scope: 'CUSTOMER', authenticationMethod: null },
    ]);
    expect((await db.query('SELECT phone FROM users WHERE id=$1', [userId])).rows[0].phone).toBe(
      '+919000007777',
    );
    expect(
      (await db.query('SELECT count(*)::int AS count FROM admin_phone_credentials')).rows[0].count,
    ).toBe(0);
  });
  it('migrates an empty database and enforces verified credential uniqueness and purpose constraints', async () => {
    await upgrade();
    const userId = await person(),
      id = randomUUID();
    await db.query(
      'INSERT INTO admin_phone_credentials (id, "userId", phone, "phoneVerifiedAt") VALUES ($1,$2,$3,now())',
      [id, userId, '+919000007777'],
    );
    await expect(
      db.query(
        'INSERT INTO admin_phone_credentials (id, "userId", phone, "phoneVerifiedAt") VALUES ($1,$2,$3,now())',
        [randomUUID(), userId, '+919000007777'],
      ),
    ).rejects.toThrow(/unique constraint/);
    await expect(
      db.query(
        'INSERT INTO admin_otp_challenges (id,purpose,phone,"browserTokenHash","expiresAt") VALUES ($1,$2,$3,$4,now()+interval $$5 minutes$$)',
        [randomUUID(), 'CUSTOMER_LOGIN', '+919000007777', 'synthetic-hash'],
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(db.query('DELETE FROM users WHERE id=$1', [userId])).rejects.toThrow(
      /foreign key constraint/,
    );
  });
  it('rolls back the additive changes and permits a safe retry', async () => {
    const userId = await person();
    await db.query('BEGIN');
    await db.query(sql(NAME).replace('BEGIN;', '').replace('COMMIT;', ''));
    await db.query(sql(CREDENTIALS).replace('BEGIN;', '').replace('COMMIT;', ''));
    await db.query('ROLLBACK');
    expect(
      (await db.query("SELECT to_regclass('admin_phone_credentials') AS name")).rows[0].name,
    ).toBeNull();
    expect((await db.query('SELECT id FROM users WHERE id=$1', [userId])).rows[0].id).toBe(userId);
    await upgrade();
    expect(
      (await db.query("SELECT to_regclass('admin_otp_redemptions') AS name")).rows[0].name,
    ).toBe('admin_otp_redemptions');
  });
});
