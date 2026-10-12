import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';

/**
 * A rehearsal of `20261012090000_dealer_document_categories` against rows in
 * the shape the three-document onboarding left behind. Additive: every row
 * keeps its type, status, file and reviewer; it is only filed under a category.
 */

const NAME = '20261012090000_dealer_document_categories';
const DIRECTORY = join(import.meta.dirname, '../prisma/migrations');
const DATABASE = 'dealersdrive_test_document_categories_migration';
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

async function legacyDealer() {
  const id = randomUUID();
  await db.query(
    `INSERT INTO dealers (id,slug,"brandName","legalName",status) VALUES ($1,$2,$3,$3,'ACTIVE')`,
    [id, 'docs-' + id, 'Synthetic ' + id],
  );
  const rows = [
    ['PAN_CARD', 'VERIFIED', 'pan.pdf'],
    ['ADDRESS_PROOF', 'UPLOADED', 'eb-bill.pdf'],
    ['GST_CERTIFICATE', 'REQUIRED', null],
  ] as const;
  for (const [type, status, fileName] of rows) {
    await db.query(
      `INSERT INTO dealer_documents (id,"dealerId",type,status,"fileName") VALUES ($1,$2,$3,$4,$5)`,
      [randomUUID(), id, type, status, fileName],
    );
  }
  return id;
}

async function documents(dealerId: string) {
  return (
    await db.query(
      `SELECT type::text, category::text, status::text, "fileName", "submissionCount", "uploadedAt" IS NOT NULL AS uploaded
       FROM dealer_documents WHERE "dealerId" = $1 ORDER BY type`,
      [dealerId],
    )
  ).rows;
}

describe('document categories migration', () => {
  it('files every legacy row under its category and keeps everything it held', async () => {
    const id = await legacyDealer();
    await db.query(sql(NAME));

    expect(await documents(id)).toEqual(
      [
        {
          type: 'GST_CERTIFICATE',
          category: 'BUSINESS_IDENTITY',
          status: 'REQUIRED',
          fileName: null,
          submissionCount: 0,
          uploaded: false,
        },
        {
          type: 'PAN_CARD',
          category: 'PERSONAL_IDENTITY',
          status: 'VERIFIED',
          fileName: 'pan.pdf',
          submissionCount: 1,
          uploaded: true,
        },
        {
          type: 'ADDRESS_PROOF',
          category: 'SUPPORTING',
          status: 'UPLOADED',
          fileName: 'eb-bill.pdf',
          submissionCount: 1,
          uploaded: true,
        },
      ].sort((a, b) => a.type.localeCompare(b.type)),
    );
    const dealer = await db.query('SELECT status FROM dealers WHERE id=$1', [id]);
    expect(dealer.rows[0].status).toBe('ACTIVE');
  });

  it('keeps one document per category per dealership', async () => {
    const id = await legacyDealer();
    await db.query(sql(NAME));
    await expect(
      db.query(
        `INSERT INTO dealer_documents (id,"dealerId",category,type) VALUES ($1,$2,'PERSONAL_IDENTITY','PASSPORT')`,
        [randomUUID(), id],
      ),
    ).rejects.toThrow(/unique constraint/);
  });

  it('refuses a type outside its category, a stray description and an out-of-range file', async () => {
    const id = randomUUID();
    await db.query(sql(NAME));
    await db.query(
      `INSERT INTO dealers (id,slug,"brandName","legalName",status) VALUES ($1,$2,$3,$3,'DRAFT')`,
      [id, 'docs-' + id, 'Synthetic ' + id],
    );
    const insert = (columns: string, values: unknown[]) =>
      db.query(
        `INSERT INTO dealer_documents (id,"dealerId",${columns}) VALUES ($1,$2,${values.map((_, i) => `$${String(i + 3)}`).join(',')})`,
        [randomUUID(), id, ...values],
      );

    await expect(insert('category,type', ['PERSONAL_IDENTITY', 'UDYAM'])).rejects.toThrow(
      /category_type_check/,
    );
    await expect(insert('category,type', ['BUSINESS_IDENTITY', 'ADDRESS_PROOF'])).rejects.toThrow(
      /category_type_check/,
    );
    await expect(
      insert('category,type,description', [
        'PERSONAL_IDENTITY',
        'PASSPORT',
        'Should not be here at all',
      ]),
    ).rejects.toThrow(/description_check/);
    await expect(
      insert('category,type,"fileName"', [
        'BUSINESS_IDENTITY',
        'OTHER_BUSINESS_CERTIFICATE',
        'other.pdf',
      ]),
    ).rejects.toThrow(/description_check/);
    await expect(
      insert('category,type,"mimeType"', ['PERSONAL_IDENTITY', 'PASSPORT', 'image/gif']),
    ).rejects.toThrow(/file_check/);
    await expect(
      insert('category,type,bytes', ['PERSONAL_IDENTITY', 'PASSPORT', 6_000_000]),
    ).rejects.toThrow(/file_check/);
    await insert('category,type,"fileName",description', [
      'BUSINESS_IDENTITY',
      'OTHER_BUSINESS_CERTIFICATE',
      'other.pdf',
      'Municipal dealer licence, Vellore',
    ]);
  });
});
