import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import pg from 'pg';
import { describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';

const NAME = '20261024120000_legal_acceptance_v1';
const DIRECTORY = join(import.meta.dirname, '../prisma/migrations');
const LEGACY = join(import.meta.dirname, 'fixtures/legal-pr279');
const sql = (name: string) => readFileSync(join(DIRECTORY, name, 'migration.sql'), 'utf8');

async function rehearsal(legacy: boolean) {
  const url = new URL(env.DATABASE_URL);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/dealersdrive_test')
    throw new Error('Legal migration rehearsal requires the isolated local test database.');
  const database = `dealersdrive_test_legal_v1_${legacy ? 'previous' : 'fresh'}`;
  url.pathname = '/dealersdrive';
  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${database}`);
  await admin.query(`CREATE DATABASE ${database}`);
  await admin.end();
  url.pathname = `/${database}`;
  const db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  try {
    await db.query(`CREATE TABLE "_prisma_migrations" (
      id VARCHAR(36) PRIMARY KEY, checksum VARCHAR(64) NOT NULL, finished_at TIMESTAMPTZ,
      migration_name VARCHAR(255) NOT NULL, logs TEXT, rolled_back_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(), applied_steps_count INTEGER NOT NULL DEFAULT 0)`);
    async function apply(name: string, body: string) {
      await db.query(body);
      await db.query(
        'INSERT INTO _prisma_migrations (id,checksum,migration_name,finished_at,applied_steps_count) VALUES ($1,$2,$3,now(),1)',
        [randomUUID(), createHash('sha256').update(body).digest('hex'), name],
      );
    }
    for (const name of readdirSync(DIRECTORY)
      .filter((name) => /^\d{14}_/.test(name) && name < NAME)
      .sort())
      await apply(name, sql(name));
    const userId = randomUUID();
    const dealerId = randomUUID();
    await db.query('INSERT INTO users (id,"fullName") VALUES ($1,$2)', [
      userId,
      'Synthetic legal rehearsal owner',
    ]);
    await db.query(
      'INSERT INTO dealers (id,slug,"brandName","legalName",status) VALUES ($1,$2,$3,$3,\'ACTIVE\')',
      [dealerId, `legal-${dealerId}`, 'Synthetic populated dealership'],
    );
    if (legacy) {
      for (const file of readdirSync(LEGACY).sort())
        await apply(file.replace('.sql', ''), readFileSync(join(LEGACY, file), 'utf8'));
      await db.query(
        `INSERT INTO legal_events (id,"actorId","subjectType","subjectId","documentId",version,digest,action,context,"eventKey") VALUES ($1,$2,'USER',$2,'terms','1.0-draft.1',$3,'ACCEPT','test-only','original-draft-evidence')`,
        [randomUUID(), userId, 'a'.repeat(64)],
      );
    }
    const before = (await db.query('SELECT * FROM users')).rows;
    const dealersBefore = (await db.query('SELECT * FROM dealers')).rows;
    const history = (await db.query('SELECT * FROM _prisma_migrations ORDER BY migration_name'))
      .rows;
    const legacyEvidence = legacy ? (await db.query('SELECT * FROM legal_events')).rows : [];
    const output = execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: url.toString() },
      encoding: 'utf8',
    });
    expect(output).toContain('successfully applied');
    expect((await db.query('SELECT * FROM users')).rows).toEqual(before);
    expect((await db.query('SELECT * FROM dealers')).rows).toEqual(dealersBefore);
    expect(
      (
        await db.query(
          'SELECT * FROM _prisma_migrations WHERE migration_name<>$1 ORDER BY migration_name',
          [NAME],
        )
      ).rows,
    ).toEqual(history);
    expect((await db.query('SELECT * FROM legal_acceptances')).rowCount).toBe(0);
    if (legacy) expect((await db.query('SELECT * FROM legal_events')).rows).toEqual(legacyEvidence);
    const insert =
      'INSERT INTO legal_acceptances (id,"subjectKey","userId","termsVersion","privacyVersion") VALUES ($1,$2,$3,\'terms-v1.0\',\'privacy-v1.0\') ON CONFLICT DO NOTHING';
    const args = [randomUUID(), `USER:${userId}`, userId];
    await db.query(insert, args);
    await db.query(insert, [randomUUID(), args[1], userId]);
    expect((await db.query('SELECT * FROM legal_acceptances')).rowCount).toBe(1);
    await expect(db.query('UPDATE legal_acceptances SET "acceptedAt"=now()')).rejects.toThrow(
      /immutable/,
    );
    await expect(db.query('DELETE FROM legal_acceptances')).rejects.toThrow(/immutable/);
    await expect(db.query('TRUNCATE legal_acceptances')).rejects.toThrow(/immutable/);
    await expect(db.query(insert, [randomUUID(), `USER:${randomUUID()}`, userId])).rejects.toThrow(
      /subject_check/,
    );
    // Previous application queries remain valid after migration and during rollback.
    expect(
      (await db.query('SELECT "fullName" FROM users WHERE id=$1', [userId])).rows[0].fullName,
    ).toBe('Synthetic legal rehearsal owner');
    expect(
      execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
        env: { ...process.env, DATABASE_URL: url.toString() },
        encoding: 'utf8',
      }),
    ).toContain('No pending migrations');
  } finally {
    await db.end();
  }
}

describe('legal V1 migration on populated installations', () => {
  it(
    'deploys additively on a current-main database and supports code rollback',
    () => rehearsal(false),
    120000,
  );
  it(
    'deploys without rewriting or inferring acceptance from PR #279 schema and applied history',
    () => rehearsal(true),
    120000,
  );
});
