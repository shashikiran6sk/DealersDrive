import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * R92's migration, run against data shaped the way production holds it today.
 *
 * A scratch database is built from every migration *before* R92, filled with a
 * dealership, its owner, a legacy `SALES` member, listings, an enquiry and a
 * live session — then R92 is applied on top. The assertions are the promise the
 * migration makes: no owner lost, nothing renamed out from under a row, every
 * existing reference still resolving.
 */
const R92 = '20261002090000_dealer_membership_rbac';
const DATABASE = 'dealersdrive_migration_r92';
const ADMIN_URL = 'postgresql://dealersdrive:dealersdrive@localhost:5432/dealersdrive';
const MIGRATIONS = join(import.meta.dirname, '../prisma/migrations');

let db: pg.Client;

function migrationSql(name: string): string {
  return readFileSync(join(MIGRATIONS, name, 'migration.sql'), 'utf8');
}

const DEALER = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222222';
const SALES = '33333333-3333-4333-8333-333333333333';
const CUSTOMER = '44444444-4444-4444-8444-444444444444';
const VEHICLE = '55555555-5555-4555-8555-555555555555';
const LISTING = '66666666-6666-4666-8666-666666666666';
const ENQUIRY = '77777777-7777-4777-8777-777777777777';

beforeAll(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${DATABASE}`);
  await admin.query(`CREATE DATABASE ${DATABASE}`);
  await admin.end();

  db = new pg.Client({
    connectionString: `postgresql://dealersdrive:dealersdrive@localhost:5432/${DATABASE}`,
  });
  await db.connect();

  const before = readdirSync(MIGRATIONS)
    .filter((name) => /^\d{14}_/.test(name) && name < R92)
    .sort();
  for (const name of before) await db.query(migrationSql(name));

  await db.query(`
    INSERT INTO "users" ("id", "fullName", "phone", "phoneVerifiedAt") VALUES
      ('${OWNER}', 'Shashikiran', '+919840000001', now()),
      ('${SALES}', 'Priya', '+919840000002', now()),
      ('${CUSTOMER}', 'Kavya', '+919840000003', now());
    INSERT INTO "dealers" ("id", "slug", "brandName", "legalName", "status", "city", "createdAt")
      VALUES ('${DEALER}', 'abc-motors', 'ABC Motors', 'ABC Motors', 'ACTIVE', 'Vellore',
              '2026-01-15 10:00:00');
    INSERT INTO "dealer_members" ("id", "dealerId", "userId", "role", "permissions", "status") VALUES
      (gen_random_uuid(), '${DEALER}', '${OWNER}', 'OWNER', '{}', 'ACTIVE'),
      (gen_random_uuid(), '${DEALER}', '${SALES}', 'SALES', '{}', 'ACTIVE');
    INSERT INTO "dealer_documents" ("id", "dealerId", "type", "status") VALUES
      (gen_random_uuid(), '${DEALER}', 'PAN_CARD', 'VERIFIED');
    INSERT INTO "vehicles" ("id", "dealerId", "registrationNumber", "updatedAt")
      VALUES ('${VEHICLE}', '${DEALER}', 'TN23AB1234', now());
    INSERT INTO "listings" ("id", "vehicleId", "dealerId", "status", "slug", "updatedAt")
      VALUES ('${LISTING}', '${VEHICLE}', '${DEALER}', 'ACTIVE', 'car-abc', now());
    INSERT INTO "enquiries" ("id", "customerId", "dealerId", "listingId", "status", "contactedAt", "updatedAt")
      VALUES ('${ENQUIRY}', '${CUSTOMER}', '${DEALER}', '${LISTING}', 'CONTACTED', now(), now());
    INSERT INTO "sessions" ("id", "userId", "tokenHash", "scope", "expiresAt")
      VALUES (gen_random_uuid(), '${OWNER}', 'hash-of-a-live-token', 'DEALER', now() + interval '1 day');
  `);

  await db.query(migrationSql(R92));
}, 120_000);

afterAll(async () => {
  await db.end();
});

describe(`migration ${R92}`, () => {
  it('keeps the owner as OWNER, and turns SALES into STAFF in place', async () => {
    const { rows } = await db.query<{ userId: string; role: string; status: string }>(
      `SELECT "userId", "role"::text, "status"::text FROM "dealer_members" ORDER BY "role"`,
    );
    expect(rows).toEqual([
      { userId: OWNER, role: 'OWNER', status: 'ACTIVE' },
      { userId: SALES, role: 'STAFF', status: 'ACTIVE' },
    ]);
  });

  it('leaves no SALES value in the enum', async () => {
    const { rows } = await db.query<{ value: string }>(
      `SELECT unnest(enum_range(NULL::"DealerRole"))::text AS value`,
    );
    expect(rows.map((row) => row.value)).toEqual(['OWNER', 'MANAGER', 'STAFF']);
  });

  it('dates an existing membership from its dealership, not from the deploy', async () => {
    const { rows } = await db.query<{ createdAt: Date }>(
      `SELECT "createdAt" FROM "dealer_members" WHERE "userId" = $1`,
      [OWNER],
    );
    expect(rows[0]?.createdAt.toISOString()).toBe('2026-01-15T10:00:00.000Z');
  });

  it('leaves every dealership with an active OWNER', async () => {
    const { rows } = await db.query<{ count: string }>(`
      SELECT count(*)::text AS count FROM "dealers" d
      WHERE NOT EXISTS (
        SELECT 1 FROM "dealer_members" m
        WHERE m."dealerId" = d."id" AND m."role" = 'OWNER' AND m."status" = 'ACTIVE'
      )`);
    expect(rows[0]?.count).toBe('0');
  });

  it('keeps the profile, documents, listing, enquiry and session exactly as they were', async () => {
    const dealer = await db.query(`SELECT "status"::text, "slug" FROM "dealers"`);
    expect(dealer.rows).toEqual([{ status: 'ACTIVE', slug: 'abc-motors' }]);
    const documents = await db.query(`SELECT "status"::text FROM "dealer_documents"`);
    expect(documents.rows).toEqual([{ status: 'VERIFIED' }]);
    const listing = await db.query(`SELECT "status"::text, "dealerId" FROM "listings"`);
    expect(listing.rows).toEqual([{ status: 'ACTIVE', dealerId: DEALER }]);
    const enquiry = await db.query(
      `SELECT "status"::text, "contactedById", "closedById" FROM "enquiries"`,
    );
    expect(enquiry.rows).toEqual([{ status: 'CONTACTED', contactedById: null, closedById: null }]);
    const session = await db.query(`SELECT "revokedAt" FROM "sessions"`);
    expect(session.rows).toEqual([{ revokedAt: null }]);
  });

  it('indexes membership by person and status', async () => {
    const { rows } = await db.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'dealer_members' ORDER BY indexname`,
    );
    expect(rows.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        'dealer_members_dealerId_status_idx',
        'dealer_members_dealerId_userId_key',
        'dealer_members_userId_status_idx',
      ]),
    );
    expect(rows.map((row) => row.indexname)).not.toContain('dealer_members_userId_idx');
  });
});
