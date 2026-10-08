import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const MIGRATION = '20261008120000_white_label_foundation';
const DATABASE = 'dealersdrive_migration_storefront';
const ROOT = join(import.meta.dirname, '../prisma/migrations');
let db: pg.Client;

beforeAll(async () => {
  const admin = new pg.Client({
    connectionString: 'postgresql://dealersdrive:dealersdrive@localhost:5432/dealersdrive',
  });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${DATABASE}`);
  await admin.query(`CREATE DATABASE ${DATABASE}`);
  await admin.end();
  db = new pg.Client({
    connectionString: `postgresql://dealersdrive:dealersdrive@localhost:5432/${DATABASE}`,
  });
  await db.connect();
  for (const name of readdirSync(ROOT)
    .filter((name) => /^\d{14}_/.test(name) && name < MIGRATION)
    .sort()) {
    await db.query(readFileSync(join(ROOT, name, 'migration.sql'), 'utf8'));
  }
  await db.query(`
    INSERT INTO users (id, "fullName") VALUES ('11111111-1111-4111-8111-111111111111', 'Synthetic buyer');
    INSERT INTO dealers (id, slug, "brandName", "legalName", status)
      VALUES ('22222222-2222-4222-8222-222222222222', 'migration-motors', 'Migration Motors', 'Migration Motors', 'ACTIVE');
    INSERT INTO vehicles (id, "dealerId", "registrationNumber", "updatedAt")
      VALUES ('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 'TN23ZZ9991', now());
    INSERT INTO listings (id, "vehicleId", "dealerId", status, slug, "updatedAt")
      VALUES ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 'ACTIVE', 'migration-car', now());
    INSERT INTO enquiries (id, "customerId", "dealerId", "listingId", "updatedAt")
      VALUES ('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-444444444444', now());
  `);
  await db.query(readFileSync(join(ROOT, MIGRATION, 'migration.sql'), 'utf8'));
}, 120_000);
afterAll(async () => {
  await db.end();
});

describe('white-label additive migration on pre-existing data', () => {
  it('retains active marketplace inventory and both destination defaults', async () => {
    const { rows } = await db.query(
      `SELECT status::text, slug, "marketplacePublished", "storefrontPublished" FROM listings`,
    );
    expect(rows).toEqual([
      {
        status: 'ACTIVE',
        slug: 'migration-car',
        marketplacePublished: true,
        storefrontPublished: true,
      },
    ]);
  });
  it('preserves enquiry ownership and adds only a marketplace default', async () => {
    const { rows } = await db.query(
      `SELECT status::text, source::text, "dealerId", "storefrontId", "storefrontHostname", "consentAt" FROM enquiries`,
    );
    expect(rows).toEqual([
      {
        status: 'NEW',
        source: 'MARKETPLACE',
        dealerId: '22222222-2222-4222-8222-222222222222',
        storefrontId: null,
        storefrontHostname: null,
        consentAt: null,
      },
    ]);
  });
  it('creates no websites or domains for existing dealers', async () => {
    const { rows } = await db.query<{ sites: string; domains: string }>(
      `SELECT (SELECT count(*) FROM dealer_storefronts)::text AS sites, (SELECT count(*) FROM storefront_domains)::text AS domains`,
    );
    expect(rows).toEqual([{ sites: '0', domains: '0' }]);
  });
  it('adds provider tracking without changing an existing domain reservation', async () => {
    await db.query(
      `INSERT INTO dealer_storefronts (id, "dealerId", subdomain, "displayName", "updatedAt") VALUES ('66666666-6666-4666-8666-666666666666', '22222222-2222-4222-8222-222222222222', 'provider-migration', 'Migration Motors', now()); INSERT INTO storefront_domains (id, "storefrontId", hostname, kind, status, "ownershipToken", "updatedAt") VALUES ('77777777-7777-4777-8777-777777777777', '66666666-6666-4666-8666-666666666666', 'provider-migration.example.com', 'CUSTOM', 'VERIFICATION_REQUIRED', 'synthetic-migration-proof', now());`,
    );
    await db.query(
      readFileSync(
        join(ROOT, '20261008170000_storefront_domain_provider', 'migration.sql'),
        'utf8',
      ),
    );
    const { rows } = await db.query(
      `SELECT hostname, status::text, "ownershipToken", "providerAttachedAt" FROM storefront_domains`,
    );
    expect(rows).toEqual([
      {
        hostname: 'provider-migration.example.com',
        status: 'VERIFICATION_REQUIRED',
        ownershipToken: 'synthetic-migration-proof',
        providerAttachedAt: null,
      },
    ]);
  });
  it('adds derivative retry metadata without rewriting existing approved media', async () => {
    await db.query(
      `INSERT INTO media (id, "dealerId", "ownerType", "storageKey", "mimeType", bytes, warnings, status) VALUES ('88888888-8888-4888-8888-888888888888', '22222222-2222-4222-8222-222222222222', 'VEHICLE', 'synthetic/approved.jpg', 'image/jpeg', 100, '{}', 'READY');`,
    );
    await db.query(
      readFileSync(join(ROOT, '20261008190000_media_derivative_retry', 'migration.sql'), 'utf8'),
    );
    const { rows } = await db.query(
      `SELECT status::text, "storageKey", bytes, "derivativesRetryAt" FROM media`,
    );
    expect(rows).toEqual([
      {
        status: 'READY',
        storageKey: 'synthetic/approved.jpg',
        bytes: 100,
        derivativesRetryAt: null,
      },
    ]);
  });
});
