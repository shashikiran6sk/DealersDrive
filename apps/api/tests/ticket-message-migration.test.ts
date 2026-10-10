import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';

const NAME = '20261010120000_ticket_message_limits';
const DIRECTORY = join(import.meta.dirname, '../prisma/migrations');
const DATABASE = 'dealersdrive_test_ticket_quota_migration';
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

async function legacy() {
  const userId = randomUUID(),
    ticketId = randomUUID();
  await db.query('INSERT INTO users (id, "fullName") VALUES ($1,$2)', [
    userId,
    'Synthetic Legacy Customer',
  ]);
  await db.query(
    'INSERT INTO support_tickets (id, "customerId",category,subject,description,"updatedAt") VALUES ($1,$2,$3,$4,$5,now())',
    [ticketId, userId, 'GENERAL_QUESTION', 'Synthetic legacy ticket', 'Original description'],
  );
  return { userId, ticketId };
}
async function message(ticketId: string, author: string, at: string) {
  const id = randomUUID();
  await db.query(
    'INSERT INTO support_ticket_messages (id,"ticketId","authorType",body,"createdAt") VALUES ($1,$2,$3,$4,$5)',
    [id, ticketId, author, 'Synthetic historical message', at],
  );
  return id;
}
describe('ticket quota additive migration', () => {
  it('upgrades an empty database and enforces count bounds and idempotent-key uniqueness', async () => {
    await db.query(sql(NAME));
    const { ticketId } = await legacy();
    await expect(
      db.query('UPDATE support_tickets SET "unansweredCustomerMessages"=6 WHERE id=$1', [ticketId]),
    ).rejects.toThrow(/check constraint/);
    const key = randomUUID();
    await db.query(
      'INSERT INTO support_ticket_messages (id,"ticketId","authorType",body,"clientMessageId") VALUES ($1,$2,$3,$4,$5)',
      [randomUUID(), ticketId, 'CUSTOMER', 'Synthetic reply', key],
    );
    await expect(
      db.query(
        'INSERT INTO support_ticket_messages (id,"ticketId","authorType",body,"clientMessageId") VALUES ($1,$2,$3,$4,$5)',
        [randomUUID(), ticketId, 'CUSTOMER', 'Duplicate retry', key],
      ),
    ).rejects.toThrow(/unique constraint/);
  });
  it('counts only customer messages since the latest support reply, blocks over-limit legacy tickets and preserves history', async () => {
    const a = await legacy(),
      b = await legacy(),
      c = await legacy();
    await message(a.ticketId, 'CUSTOMER', '2026-10-01T01:00:00Z');
    await message(a.ticketId, 'SUPPORT', '2026-10-01T02:00:00Z');
    await message(a.ticketId, 'CUSTOMER', '2026-10-01T03:00:00Z');
    await message(a.ticketId, 'CUSTOMER', '2026-10-01T04:00:00Z');
    for (let i = 0; i < 8; i += 1) await message(b.ticketId, 'CUSTOMER', `2026-10-01T0${i}:00:00Z`);
    const before = (await db.query('SELECT id,body FROM support_ticket_messages ORDER BY id')).rows;
    await db.query(sql(NAME));
    const rows = (
      await db.query('SELECT id,"unansweredCustomerMessages" AS count FROM support_tickets')
    ).rows;
    expect(rows.find((r) => r.id === a.ticketId).count).toBe(2);
    expect(rows.find((r) => r.id === b.ticketId).count).toBe(5);
    expect(rows.find((r) => r.id === c.ticketId).count).toBe(0);
    expect(
      (await db.query('SELECT id,body FROM support_ticket_messages ORDER BY id')).rows,
    ).toEqual(before);
  });
  it('conservatively counts same-timestamp customer messages where legacy ordering is ambiguous', async () => {
    const t = await legacy();
    await message(t.ticketId, 'SUPPORT', '2026-10-01T01:00:00Z');
    await message(t.ticketId, 'CUSTOMER', '2026-10-01T01:00:00Z');
    await db.query(sql(NAME));
    expect(
      (
        await db.query(
          'SELECT "unansweredCustomerMessages" AS count FROM support_tickets WHERE id=$1',
          [t.ticketId],
        )
      ).rows[0].count,
    ).toBe(1);
  });
  it('rolls back and permits retry without deleting tickets, authors or messages', async () => {
    const t = await legacy();
    const id = await message(t.ticketId, 'CUSTOMER', '2026-10-01T01:00:00Z');
    await db.query('BEGIN');
    await db.query(sql(NAME).replace('BEGIN;', '').replace('COMMIT;', ''));
    await db.query('ROLLBACK');
    expect(
      (await db.query('SELECT id FROM support_ticket_messages WHERE id=$1', [id])).rows[0].id,
    ).toBe(id);
    expect(
      (
        await db.query(
          "SELECT count(*)::int AS count FROM information_schema.columns WHERE table_name='support_tickets' AND column_name='unansweredCustomerMessages'",
        )
      ).rows[0].count,
    ).toBe(0);
    await db.query(sql(NAME));
    expect(
      (
        await db.query(
          'SELECT "unansweredCustomerMessages" AS count FROM support_tickets WHERE id=$1',
          [t.ticketId],
        )
      ).rows[0].count,
    ).toBe(1);
  });
});
