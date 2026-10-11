import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';

const NAME = '20261009160000_dealer_primary_email';
const DIRECTORY = join(import.meta.dirname, '../prisma/migrations');
const DATABASE = 'dealersdrive_test_email_migration';
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

async function person(email: string) {
  const id = randomUUID();
  await db.query('INSERT INTO "users" ("id", "email") VALUES ($1, $2)', [id, email]);
  return id;
}

async function dealer(email: string, ownerId?: string) {
  const id = randomUUID();
  await db.query(
    'INSERT INTO "dealers" ("id", "slug", "brandName", "legalName", "contactEmail") VALUES ($1, $2, $2, $2, $3)',
    [id, `migration-${id}`, email],
  );
  if (ownerId) {
    await db.query(
      'INSERT INTO "dealer_members" ("id", "dealerId", "userId", "role", "permissions") VALUES ($1, $2, $3, \'OWNER\', \'{}\')',
      [randomUUID(), id, ownerId],
    );
  }
  return id;
}

async function blocked(message: RegExp) {
  await expect(db.query(sql(NAME))).rejects.toThrow(message);
  await db.query('ROLLBACK');
  const columns = await db.query(
    "SELECT 1 FROM information_schema.columns WHERE table_name = 'dealers' AND column_name = 'primaryOwnerEmail'",
  );
  expect(columns.rowCount).toBe(0);
}

describe('canonical primary email migration', () => {
  it('preserves existing identities, memberships and listings while deriving the verified owner email', async () => {
    const owner = await person('Owner@Example.TEST');
    const id = await dealer('public-contact@example.test', owner);
    await db.query(
      'INSERT INTO "oauth_identities" ("id", "userId", "provider", "providerSubject", "email", "emailVerified", "updatedAt") VALUES ($1::uuid, $2::uuid, \'GOOGLE\', $1::text, $3, true, now())',
      [randomUUID(), owner, ' OWNER@EXAMPLE.TEST '],
    );
    const vehicle = randomUUID(),
      listing = randomUUID();
    await db.query(
      'INSERT INTO "vehicles" ("id", "dealerId", "registrationNumber", "updatedAt") VALUES ($1, $2, \'TN00QA1001\', now())',
      [vehicle, id],
    );
    await db.query(
      'INSERT INTO "listings" ("id", "vehicleId", "dealerId", "slug", "updatedAt") VALUES ($1, $2, $3, \'migration-listing\', now())',
      [listing, vehicle, id],
    );
    await db.query(sql(NAME));
    const row = await db.query(
      'SELECT "primaryOwnerEmail", "contactEmail" FROM "dealers" WHERE "id" = $1',
      [id],
    );
    expect(row.rows[0]).toEqual({
      primaryOwnerEmail: 'owner@example.test',
      contactEmail: 'public-contact@example.test',
    });
    expect(
      (await db.query('SELECT "email" FROM "users" WHERE "id" = $1', [owner])).rows[0].email,
    ).toBe('owner@example.test');
    expect(
      (await db.query('SELECT "userId" FROM "dealer_members" WHERE "dealerId" = $1', [id])).rows[0]
        .userId,
    ).toBe(owner);
    expect(
      (await db.query('SELECT "vehicleId", "dealerId" FROM "listings" WHERE "id" = $1', [listing]))
        .rows[0],
    ).toEqual({ vehicleId: vehicle, dealerId: id });
  });

  it('blocks conflicting case-insensitive user identities without merging or changing records', async () => {
    const left = await person('Case@Example.TEST');
    const right = await person('case@example.test');
    await blocked(/conflicting account email groups/);
    expect(
      (await db.query('SELECT "email" FROM "users" WHERE "id" = $1', [left])).rows[0].email,
    ).toBe('Case@Example.TEST');
    expect(
      (await db.query('SELECT "email" FROM "users" WHERE "id" = $1', [right])).rows[0].email,
    ).toBe('case@example.test');
  });

  it('blocks conflicting assisted declarations and supports a reviewed forward correction', async () => {
    const left = await dealer('same@example.test'),
      right = await dealer(' SAME@EXAMPLE.TEST ');
    await blocked(/conflicting primary dealer email groups/);
    expect((await db.query('SELECT count(*)::int AS n FROM "dealers"')).rows[0].n).toBe(2);
    await db.query(
      'UPDATE "dealers" SET "contactEmail" = \'corrected@example.test\' WHERE "id" = $1',
      [right],
    );
    await db.query(sql(NAME));
    const rows = await db.query(
      'SELECT "id", "primaryOwnerEmail" FROM "dealers" ORDER BY "primaryOwnerEmail"',
    );
    expect(rows.rows).toEqual([
      { id: right, primaryOwnerEmail: 'corrected@example.test' },
      { id: left, primaryOwnerEmail: 'same@example.test' },
    ]);
  });

  it('blocks ambiguous multiple owners instead of selecting one silently', async () => {
    const first = await person('first@example.test'),
      second = await person('second@example.test');
    const id = await dealer('contact@example.test', first);
    await db.query(
      'INSERT INTO "dealer_members" ("id", "dealerId", "userId", "role", "permissions") VALUES ($1, $2, $3, \'OWNER\', \'{}\')',
      [randomUUID(), id, second],
    );
    await blocked(/multiple active owners/);
    expect(
      (
        await db.query('SELECT count(*)::int AS n FROM "dealer_members" WHERE "dealerId" = $1', [
          id,
        ])
      ).rows[0].n,
    ).toBe(2);
  });

  it('refreshes derived ownership on account changes and prevents raw duplicate identities', async () => {
    const owner = await person('original@example.test');
    const id = await dealer('original@example.test', owner);
    await db.query(sql(NAME));
    await db.query('UPDATE "users" SET "email" = \' Updated@Example.TEST \' WHERE "id" = $1', [
      owner,
    ]);
    expect(
      (await db.query('SELECT "primaryOwnerEmail" FROM "dealers" WHERE "id" = $1', [id])).rows[0]
        .primaryOwnerEmail,
    ).toBe('updated@example.test');
    await expect(
      db.query('INSERT INTO "users" ("id", "email") VALUES ($1, \'UPDATED@EXAMPLE.TEST\')', [
        randomUUID(),
      ]),
    ).rejects.toMatchObject({ code: '23505' });
  });
});
