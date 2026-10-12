import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';

/**
 * A rehearsal of `20261012100000_dealer_activation_override`: every dealership
 * that is ACTIVE or SUSPENDED today was approved through the standard review
 * and is marked so; nothing else changes.
 */

const NAME = '20261012100000_dealer_activation_override';
const DIRECTORY = join(import.meta.dirname, '../prisma/migrations');
const DATABASE = 'dealersdrive_test_activation_override_migration';
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

async function dealer(status: string) {
  const id = randomUUID();
  await db.query(
    `INSERT INTO dealers (id,slug,"brandName","legalName",status) VALUES ($1,$2,$3,$3,$4)`,
    [id, 'activation-' + id, 'Synthetic ' + id, status],
  );
  return id;
}

describe('activation override migration', () => {
  it('marks only ACTIVE and SUSPENDED dealerships as standard approvals', async () => {
    const ids = {
      DRAFT: await dealer('DRAFT'),
      PENDING_APPROVAL: await dealer('PENDING_APPROVAL'),
      ACTIVE: await dealer('ACTIVE'),
      SUSPENDED: await dealer('SUSPENDED'),
      REJECTED: await dealer('REJECTED'),
    };
    await db.query(sql(NAME));
    const rows = await db.query(
      `SELECT id, status::text, "activationMethod"::text AS method FROM dealers WHERE id = ANY($1::uuid[])`,
      [Object.values(ids)],
    );
    const method = (id: string) => rows.rows.find((row) => row.id === id)?.method ?? null;
    expect(method(ids.ACTIVE)).toBe('STANDARD');
    expect(method(ids.SUSPENDED)).toBe('STANDARD');
    expect(method(ids.DRAFT)).toBeNull();
    expect(method(ids.PENDING_APPROVAL)).toBeNull();
    expect(method(ids.REJECTED)).toBeNull();
    expect(rows.rows.map((row) => row.status).sort()).toEqual(
      ['ACTIVE', 'DRAFT', 'PENDING_APPROVAL', 'REJECTED', 'SUSPENDED'].sort(),
    );
  });

  it('refuses a manual activation without who, when and a real justification', async () => {
    const id = await dealer('DRAFT');
    await db.query(sql(NAME));
    await expect(
      db.query(
        `UPDATE dealers SET status='ACTIVE', "activationMethod"='MANUAL_OVERRIDE' WHERE id=$1`,
        [id],
      ),
    ).rejects.toThrow(/activation_override_check/);
    await expect(
      db.query(
        `UPDATE dealers SET "activationMethod"='MANUAL_OVERRIDE', "activationOverrideAt"=now(),
         "activationOverrideById"=$2, "activationOverrideReason"='ok' WHERE id=$1`,
        [id, randomUUID()],
      ),
    ).rejects.toThrow(/activation_override_check/);
    await db.query(
      `UPDATE dealers SET "activationMethod"='MANUAL_OVERRIDE', "activationOverrideAt"=now(),
       "activationOverrideById"=$2, "activationOverrideReason"=$3 WHERE id=$1`,
      [id, randomUUID(), 'Field verification under policy exception OPS-2026-114, approved.'],
    );
  });
});
