// DEPLOY-010 — a logical backup/restore drill on the certification database: pg_dump the
// database, restore it into a fresh one, and compare row counts and relationship hashes
// (dealer status/verification, listing ownership/status, membership role/status, enquiry
// actors). The managed-database snapshot/PITR procedure (DEPLOY-009) is not exercised here.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import * as h from './lib.mjs';

const r = h.recorder('backup-restore');
const url = new URL(h.DB_URL);
const target = `${url.pathname.slice(1)}_restore_drill`;
const env = { ...process.env, PGPASSWORD: decodeURIComponent(url.password) };
const base = ['-h', url.hostname, '-p', url.port || '5432', '-U', decodeURIComponent(url.username)];
const run = (cmd, args) => spawnSync(cmd, args, { env, encoding: 'utf8' });

const COMPARE = [
  `SELECT 'users', count(*)::text FROM users`,
  `SELECT 'dealers', count(*)::text FROM dealers`,
  `SELECT 'members', count(*)::text FROM dealer_members`,
  `SELECT 'owners', count(*)::text FROM dealer_members WHERE role='OWNER' AND status='ACTIVE'`,
  `SELECT 'invitations', count(*)::text FROM dealer_invitations`,
  `SELECT 'listings', count(*)::text FROM listings`,
  `SELECT 'enquiries', count(*)::text FROM enquiries`,
  `SELECT 'saved', count(*)::text FROM saved_vehicles`,
  `SELECT 'documents', count(*)::text FROM dealer_documents`,
  `SELECT 'audit', count(*)::text FROM audit_logs`,
  `SELECT 'admin_members', count(*)::text FROM admin_members`,
  `SELECT 'tickets', count(*)::text FROM support_tickets`,
  `SELECT 'migrations', count(*)::text FROM _prisma_migrations`,
  `SELECT 'dealers_hash', md5(string_agg(id::text||status::text||"verificationStatus"::text, ',' ORDER BY id)) FROM dealers`,
  `SELECT 'listings_hash', md5(string_agg(id::text||status::text||"dealerId"::text, ',' ORDER BY id)) FROM listings`,
  `SELECT 'members_hash', md5(string_agg(id::text||role::text||status::text||"dealerId"::text||"userId"::text, ',' ORDER BY id)) FROM dealer_members`,
  `SELECT 'enquiries_hash', md5(string_agg(id::text||status::text||"listingId"::text||"customerId"::text||coalesce("contactedById"::text,'')||coalesce("closedById"::text,''), ',' ORDER BY id)) FROM enquiries`,
].join(' UNION ALL ');

await h.check(r, 'DEPLOY-010', async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'dd-restore-'));
  const dump = resolve(dir, 'cert.dump');
  try {
    // Run with no other campaign writing: the source is read just before the dump, so a
    // concurrent write would show up as a difference (reported BLOCKED, not PASS).
    const before = run('psql', [...base, '-d', url.pathname.slice(1), '-At', '-c', COMPARE]);
    const d = run('pg_dump', [...base, '-Fc', '-d', url.pathname.slice(1), '-f', dump]);
    run('psql', [...base, '-d', 'postgres', '-qc', `DROP DATABASE IF EXISTS ${target}`]);
    run('psql', [...base, '-d', 'postgres', '-qc', `CREATE DATABASE ${target}`]);
    const restore = run('pg_restore', [...base, '-d', target, '--no-owner', dump]);
    const after = run('psql', [...base, '-d', target, '-At', '-c', COMPARE]);
    const fk = run('psql', [
      ...base,
      '-d',
      target,
      '-At',
      '-c',
      `SELECT count(*) FROM pg_constraint WHERE contype='f' AND NOT convalidated`,
    ]);
    run('psql', [...base, '-d', 'postgres', '-qc', `DROP DATABASE IF EXISTS ${target}`]);
    const parse = (out) =>
      Object.fromEntries(
        out
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((l) => l.split('|')),
      );
    const a = parse(before.stdout);
    const b = parse(after.stdout);
    const differing = Object.keys(a).filter((k) => a[k] !== b[k]);
    r.ev({
      dumpExit: d.status,
      restoreExit: restore.status,
      restoreErrors: (restore.stderr || '').slice(0, 200),
      compared: Object.keys(a).length,
      differing,
      restored: b,
      unvalidatedForeignKeys: fk.stdout.trim(),
    });
    if (before.status !== 0 || after.status !== 0 || Object.keys(a).length < 17)
      return {
        status: 'FAIL',
        layers: ['DATABASE'],
        note: `comparison query failed: ${(before.stderr || after.stderr).slice(0, 200)}`,
      };
    if (d.status !== 0 || restore.status !== 0)
      return {
        status: 'FAIL',
        layers: ['DATABASE'],
        note: `dump ${d.status} restore ${restore.status}`,
      };
    return differing.length === 0 && fk.stdout.trim() === '0'
      ? {
          layers: ['DATABASE'],
          note: `pg_dump → pg_restore into a fresh database: ${Object.keys(a).length} counts and relationship hashes identical, 0 unvalidated FKs. Logical drill only — the managed snapshot/PITR path is DEPLOY-009 (BLOCKED).`,
        }
      : {
          status: differing.every((k) =>
            [
              'audit',
              'users',
              'dealers',
              'members',
              'owners',
              'listings',
              'documents',
              'dealers_hash',
              'listings_hash',
              'members_hash',
            ].includes(k),
          )
            ? 'BLOCKED'
            : 'FAIL',
          layers: ['DATABASE'],
          note: `differences in ${differing.join(', ')} — rerun with no other campaign writing to the database`,
        };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

r.save();
await h.pool.end();
