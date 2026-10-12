import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';

/**
 * A rehearsal of `20261012110000_dealer_portfolio_and_yard_visits` against
 * dealerships carrying the single yard photograph onboarding used to collect.
 * Additive: no media row, object or `coverMediaId` changes. A reviewed
 * dealership keeps its image public as an approved portfolio photograph; one
 * still in onboarding gets a pending one a reviewer must decide.
 */

const NAME = '20261012110000_dealer_portfolio_and_yard_visits';
const DIRECTORY = join(import.meta.dirname, '../prisma/migrations');
const DATABASE = 'dealersdrive_test_portfolio_migration';
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

async function dealerWithCover(status: string, mediaStatus = 'READY') {
  const id = randomUUID();
  const mediaId = randomUUID();
  await db.query(
    `INSERT INTO dealers (id,slug,"brandName","legalName",status) VALUES ($1,$2,$3,$3,$4)`,
    [id, 'cover-' + id, 'Synthetic ' + id, status],
  );
  await db.query(
    `INSERT INTO media (id,"dealerId","ownerType","storageKey","mimeType",bytes,status)
     VALUES ($1,$2,'DEALER_COVER',$3,'image/jpeg',8,$4)`,
    [mediaId, id, `dealers/cover-${id}/yard/${mediaId}`, mediaStatus],
  );
  await db.query(`UPDATE dealers SET "coverMediaId" = $2 WHERE id = $1`, [id, mediaId]);
  return { id, mediaId };
}

async function portfolio(dealerId: string) {
  return (
    await db.query(
      `SELECT "mediaId", status::text, "legacyCover", position FROM dealer_portfolio_photos WHERE "dealerId" = $1`,
      [dealerId],
    )
  ).rows;
}

describe('portfolio migration', () => {
  it('carries a reviewed dealership’s cover over as an approved legacy photograph', async () => {
    const active = await dealerWithCover('ACTIVE');
    const suspended = await dealerWithCover('SUSPENDED');
    await db.query(sql(NAME));

    for (const dealer of [active, suspended]) {
      expect(await portfolio(dealer.id)).toEqual([
        { mediaId: dealer.mediaId, status: 'APPROVED', legacyCover: true, position: 0 },
      ]);
    }
  });

  it('files an onboarding dealership’s photograph as pending review', async () => {
    const draft = await dealerWithCover('DRAFT');
    const pending = await dealerWithCover('PENDING_APPROVAL');
    await db.query(sql(NAME));

    expect((await portfolio(draft.id))[0]?.status).toBe('PENDING');
    expect((await portfolio(pending.id))[0]?.status).toBe('PENDING');
  });

  it('carries nothing for a closed or rejected dealership, or an unready upload', async () => {
    const closed = await dealerWithCover('CLOSED');
    const rejected = await dealerWithCover('REJECTED');
    const unready = await dealerWithCover('ACTIVE', 'PENDING');
    await db.query(sql(NAME));

    for (const dealer of [closed, rejected, unready])
      expect(await portfolio(dealer.id)).toEqual([]);
  });

  it('changes no media row and no cover pointer', async () => {
    const active = await dealerWithCover('ACTIVE');
    const before = await db.query(`SELECT * FROM media WHERE id = $1`, [active.mediaId]);
    await db.query(sql(NAME));

    expect((await db.query(`SELECT * FROM media WHERE id = $1`, [active.mediaId])).rows).toEqual(
      before.rows,
    );
    const dealer = await db.query(`SELECT "coverMediaId" FROM dealers WHERE id = $1`, [active.id]);
    expect(dealer.rows[0].coverMediaId).toBe(active.mediaId);
  });

  it('holds one pending replacement per photograph and a reason on every rejection', async () => {
    const active = await dealerWithCover('ACTIVE');
    await db.query(sql(NAME));
    const [original] = (
      await db.query(`SELECT id FROM dealer_portfolio_photos WHERE "dealerId" = $1`, [active.id])
    ).rows;
    const insert = (status: string, reason?: string) =>
      db.query(
        `INSERT INTO dealer_portfolio_photos
           (id,"dealerId","mediaId",status,"replacesId","rejectionReason","reviewedById","reviewedAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())`,
        [
          randomUUID(),
          active.id,
          randomUUID(),
          status,
          original.id,
          reason ?? null,
          reason ? randomUUID() : null,
          reason ? new Date() : null,
        ],
      );

    await insert('PENDING');
    await expect(insert('PENDING')).rejects.toThrow(/one_pending_replacement/);
    await expect(insert('REJECTED')).rejects.toThrow(/rejection_check/);
    await expect(insert('APPROVED')).rejects.toThrow(/review_check/);
    await insert('REJECTED', 'Blurred photograph');
  });
});
