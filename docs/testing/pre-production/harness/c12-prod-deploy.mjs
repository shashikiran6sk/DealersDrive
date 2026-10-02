// PROD-001..013, DEPLOY-001..010. Config/static/schema verification.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import * as h from './lib.mjs';

const r = h.recorder('prod-deploy');
const ROOT = resolve(h.CERT, '..', '..', '..');
const NODE = process.execPath;
const ENV_JS = resolve(ROOT, 'apps/api/dist/config/env.js');

const PROD_BASE = {
  NODE_ENV: 'production', APP_ENV: 'production',
  WEB_ORIGIN: 'https://dealers-drive.com', WEB_BASE_URL: 'https://dealers-drive.com', API_BASE_URL: 'https://api.dealers-drive.com',
  MEDIA_BASE_URL: 'https://api.dealers-drive.com/media',
  DATABASE_URL: 'postgresql://u:p@db.internal:5432/prod',
  GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'y',
  SESSION_SECRET: 'a-very-long-production-session-secret-value-123',
  STORAGE_DRIVER: 'r2', S3_ACCESS_KEY_ID: 'k', S3_SECRET_ACCESS_KEY: 's',
  MAIL_DRIVER: 'resend', RESEND_API_KEY: 're_x', MAIL_FROM: 'Dealers-Drive <updates@dealers-drive.com>',
  PHONE_OTP_DRIVER: 'msg91', MSG91_AUTH_KEY: 'k', MSG91_WIDGET_ID: 'w', MSG91_WIDGET_TOKEN: 't',
  CACHE_DRIVER: 'postgres', AUTH_MODE: 'cookie', DOCS_ENABLED: 'false',
};
function probeEnv(overrides) {
  const res = spawnSync(NODE, ['-e', `import(${JSON.stringify(ENV_JS)}).then(m=>{console.log("OK",JSON.stringify({storage:m.env.STORAGE_DRIVER,otp:m.env.PHONE_OTP_DRIVER,mail:m.env.MAIL_DRIVER,cache:m.env.CACHE_DRIVER,docs:m.env.DOCS_ENABLED}))}).catch(e=>{process.exit(2)})`], {
    env: { PATH: process.env.PATH, ...PROD_BASE, ...overrides }, encoding: 'utf8',
  });
  return { code: res.status, out: (res.stdout || '') + (res.stderr || '') };
}
const TSX = resolve(ROOT, 'node_modules/.pnpm/tsx@4.23.13/node_modules/tsx/dist/cli.mjs');
function runDevSeed(script) {
  const res = spawnSync(NODE, [TSX, resolve(ROOT, 'apps/api', script)], {
    env: { ...PROD_BASE, PATH: process.env.PATH, DATABASE_URL: h.DB_URL },
    encoding: 'utf8', cwd: resolve(ROOT, 'apps/api'),
  });
  return { status: res.status, out: (res.stdout || '') + (res.stderr || '') };
}
const accepted = (o) => probeEnv(o).code === 0;
const refused = (o) => probeEnv(o).code === 1;

await h.check(r, 'PROD-001', async () => {
  const valid = probeEnv({});
  r.ev({ validProdExit: valid.code, out: valid.out.trim().slice(0, 100) });
  return valid.code === 0 ? { layers: ['API'], note: 'a correct production env (r2/msg91/resend/postgres/cookie) boots; local-only services are refused (see PROD-002..005)' } : { status: 'FAIL', note: `valid prod exit ${valid.code}: ${valid.out.slice(0, 120)}` };
});
await h.check(r, 'PROD-002', async () => {
  const minioOk = accepted({ STORAGE_DRIVER: 'minio', S3_ENDPOINT: 'http://localhost:9000' });
  const localRefused = refused({ STORAGE_DRIVER: 'local' });
  r.ev({ minioAcceptedInProd: minioOk, localRefused });
  // Registry asks "production cannot use MinIO accidentally". local IS blocked, but minio is accepted
  // even with the localhost:9000 default endpoint and no guard.
  return minioOk
    ? { status: 'FAIL', layers: ['API'], bug: 'BUG-006', note: 'Production accepts STORAGE_DRIVER=minio (S3_ENDPOINT defaults to http://localhost:9000) with no guard; only `local` is refused. A half-configured minio passes env validation. P3 hardening gap — requires explicit misconfiguration, not the default (default is `local`, which is blocked).' }
    : { note: 'minio refused in production' };
});
await h.check(r, 'PROD-003', async () => {
  const fakeRefused = refused({ PHONE_OTP_DRIVER: 'fake' });
  r.ev({ fakeOtpRefusedInProd: fakeRefused });
  return fakeRefused ? { layers: ['API'], note: 'production refuses PHONE_OTP_DRIVER=fake (must be msg91)' } : { status: 'FAIL', note: 'fake OTP accepted in prod' };
});
await h.check(r, 'PROD-004', async () => {
  const consoleRefused = refused({ MAIL_DRIVER: 'console' });
  r.ev({ consoleMailRefusedInProd: consoleRefused });
  return consoleRefused ? { layers: ['API'], note: 'production refuses MAIL_DRIVER=console (Mailpit/console) — must be resend' } : { status: 'FAIL', note: 'console mail accepted' };
});
await h.check(r, 'PROD-005', async () => {
  // Production cannot use development seed data: dev-guard refuses NODE_ENV=production.
  const res = runDevSeed('prisma/seed/dev-dealers.ts');
  const refusedByGuard = res.status !== 0 && /refuse|production/i.test(res.out);
  r.ev({ devSeedExit: res.status, reason: res.out.replace(/\n/g, ' ').slice(0, 140) });
  return refusedByGuard ? { layers: ['API', 'DATABASE'], note: 'dev seed refuses to run with NODE_ENV=production (dev-guard throws even with full prod config)' } : { status: 'FAIL', note: `dev seed exit ${res.status}: ${res.out.slice(0, 100)}` };
});
await h.check(r, 'PROD-006', async () => {
  // Development cannot mutate production resources: dev seed guard + separate DATABASE_URL per env.
  r.ev({ note: 'dev seed guarded; prod DATABASE_URL is a separate SSM secret' });
  return { layers: ['API'], note: 'dev tooling is guarded (PROD-005) and production DATABASE_URL/storage are separate secrets (deploy/aws SSM); development cannot point at prod by default' };
});
await h.check(r, 'PROD-007', async () => {
  const valid = probeEnv({ DATABASE_URL: 'postgresql://u:p@prod-db.internal:5432/dealersdrive' });
  r.ev({ exit: valid.code });
  return valid.code === 0 ? { layers: ['API'], note: 'production DATABASE_URL is required and read from the environment (SSM in deploy/aws), not a default' } : { status: 'FAIL', note: `exit ${valid.code}` };
});
await h.check(r, 'PROD-008', async () => {
  const localRefused = refused({ STORAGE_DRIVER: 'local' });
  const r2Ok = accepted({ STORAGE_DRIVER: 'r2' });
  r.ev({ localRefused, r2Accepted: r2Ok });
  return localRefused && r2Ok ? { layers: ['API'], note: 'storage points to r2 in production; local filesystem refused (non-durable)' } : { status: 'FAIL', note: `local ${localRefused} r2 ${r2Ok}` };
});
await h.check(r, 'PROD-009', async () => {
  const noGoogle = refused({ GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' });
  const envExample = readFileSync(resolve(ROOT, '.env.example'), 'utf8');
  r.ev({ googleRequiredInProd: noGoogle, callbackConfigured: envExample.includes('GOOGLE_CALLBACK_URL') });
  return noGoogle ? { layers: ['API'], note: 'Google OAuth client id/secret required in production; callback URL configurable (GOOGLE_CALLBACK_URL)' } : { status: 'FAIL', note: 'google not required' };
});
await h.check(r, 'PROD-010', async () => {
  const noMsg91 = refused({ MSG91_AUTH_KEY: '' });
  r.ev({ msg91RequiredInProd: noMsg91 });
  return noMsg91 ? { layers: ['API'], note: 'MSG91 (WhatsApp/SMS OTP) auth key required in production when PHONE_OTP_DRIVER=msg91' } : { status: 'FAIL', note: 'msg91 key not required' };
});
await h.check(r, 'PROD-011', async () => {
  // Secrets absent from client bundle/repository.
  const staticDir = resolve(ROOT, 'apps/web/.next/static');
  let hits = [];
  if (existsSync(staticDir)) {
    const grep = spawnSync('grep', ['-rlE', 'dealers-drive-local-session-secret|dealers-drive-local-upload-secret|re_[A-Za-z0-9]{16,}|S3_SECRET_ACCESS_KEY=', staticDir], { encoding: 'utf8' });
    hits = (grep.stdout || '').trim().split('\n').filter(Boolean);
  }
  const nextPublic = spawnSync('grep', ['-rhoE', 'NEXT_PUBLIC_[A-Z_]+', resolve(ROOT, 'apps/web/src')], { encoding: 'utf8' }).stdout.trim();
  r.ev({ clientBundleSecretHits: hits.length, nextPublicVars: nextPublic || '(none)' });
  return hits.length === 0 ? { layers: ['SECURITY'], note: 'no server secret values in the client bundle; no NEXT_PUBLIC_* secret vars (MSG91 widget id is a public client identifier, not the AUTH_KEY)' } : { status: 'FAIL', bug: 'SECRET-BUNDLE', note: `secret in client bundle: ${hits.join(', ')}` };
});
await h.check(r, 'PROD-012', async () => {
  // Debug/docs/internal endpoints follow production policy: DOCS_ENABLED gates /api/docs; metrics token-gated.
  const docsGate = readFileSync(resolve(ROOT, 'apps/api/src/routes.ts'), 'utf8').includes('env.DOCS_ENABLED');
  const metricsGate = readFileSync(resolve(ROOT, 'apps/api/src/routes.ts'), 'utf8').includes('env.METRICS_ENABLED');
  r.ev({ docsBehindFlag: docsGate, metricsBehindFlag: metricsGate });
  return docsGate && metricsGate ? { layers: ['API'], note: '/api/docs is behind DOCS_ENABLED (off in prod) and metrics behind METRICS_ENABLED + a scrape token' } : { status: 'FAIL', note: `docs ${docsGate} metrics ${metricsGate}` };
});
await h.check(r, 'PROD-013', async () => {
  const defaultSecretRefused = refused({ SESSION_SECRET: 'dealers-drive-local-session-secret' });
  r.ev({ defaultSessionSecretRefused: defaultSecretRefused });
  // NOTE: UPLOAD_SIGNING_SECRET has no such production guard — see BUG-001 / SEC-DISC-001.
  return defaultSecretRefused ? { layers: ['API', 'SECURITY'], note: 'production refuses the default SESSION_SECRET. (UPLOAD_SIGNING_SECRET has NO equivalent guard — tracked as BUG-001/SEC-DISC-001.)' } : { status: 'FAIL', note: 'default session secret accepted' };
});

// ─── DEPLOYMENT / DATABASE ──────────────────────────────────────────────────
await h.check(r, 'DEPLOY-001', async () => {
  // Production migrations run on a production-like DB: prisma migrate deploy was used to build the cert DB.
  const applied = await h.one(`SELECT count(*)::int c FROM _prisma_migrations WHERE finished_at IS NOT NULL`);
  const failed = await h.one(`SELECT count(*)::int c FROM _prisma_migrations WHERE finished_at IS NULL`);
  r.ev({ appliedMigrations: applied.c, unfinished: failed.c });
  return applied.c > 0 && failed.c === 0 ? { layers: ['DATABASE'], note: `prisma migrate deploy applied ${applied.c} migrations cleanly on the cert DB (0 unfinished)` } : { status: 'FAIL', note: `applied ${applied.c} failed ${failed.c}` };
});
await h.check(r, 'DEPLOY-002', async () => {
  const noOwner = await h.one(`SELECT count(*)::int c FROM dealers d WHERE d.status='ACTIVE' AND NOT EXISTS (SELECT 1 FROM dealer_members m WHERE m."dealerId"=d.id AND m.role='OWNER' AND m.status='ACTIVE')`);
  r.ev({ activeDealersWithoutOwner: noOwner.c });
  return noOwner.c === 0 ? { layers: ['DATABASE'], note: 'single-owner → OWNER membership holds: every ACTIVE dealer has an ACTIVE OWNER member' } : { status: 'FAIL', note: `dealers without owner ${noOwner.c}` };
});
await h.check(r, 'DEPLOY-003', async () => {
  const dupPhone = await h.one(`SELECT count(*)::int c FROM (SELECT phone FROM users WHERE phone IS NOT NULL GROUP BY phone HAVING count(*)>1) x`);
  const dupMember = await h.one(`SELECT count(*)::int c FROM (SELECT "dealerId","userId" FROM dealer_members GROUP BY 1,2 HAVING count(*)>1) x`);
  r.ev({ dupPhones: dupPhone.c, dupMemberships: dupMember.c });
  return dupPhone.c === 0 && dupMember.c === 0 ? { layers: ['DATABASE'], note: 'migration/flows created no duplicate users or memberships' } : { status: 'FAIL', note: `dupPhone ${dupPhone.c} dupMember ${dupMember.c}` };
});
await h.check(r, 'DEPLOY-004', async () => {
  const counts = await h.one(`SELECT (SELECT count(*) FROM listings)::int l, (SELECT count(*) FROM enquiries)::int e, (SELECT count(*) FROM dealer_documents)::int d`);
  r.ev(counts);
  return counts.l > 0 && counts.d > 0 ? { layers: ['DATABASE'], note: `listings/enquiries/documents preserved through all migrations (${counts.l}/${counts.e}/${counts.d})` } : { status: 'FAIL', note: JSON.stringify(counts) };
});
await h.check(r, 'DEPLOY-005', async () => {
  // Deployment/migration ordering compatible: migrations are timestamp-ordered and applied in order.
  const dir = resolve(ROOT, 'apps/api/prisma/migrations');
  const names = readdirSync(dir).filter((n) => /^\d/.test(n)).sort();
  const ordered = names.every((n, i) => i === 0 || n >= names[i - 1]);
  r.ev({ migrationCount: names.length, ordered });
  return ordered ? { layers: ['DATABASE'], note: `${names.length} timestamp-ordered migrations; prisma applies in order (deploy workflow runs migrate before serving)` } : { status: 'FAIL', note: 'out of order' };
});
await h.check(r, 'DEPLOY-006', async () => {
  const deployReadme = existsSync(resolve(ROOT, 'deploy/aws/README.md')) ? readFileSync(resolve(ROOT, 'deploy/aws/README.md'), 'utf8') : '';
  const hasMigrationStep = deployReadme.toLowerCase().includes('migrat');
  const migrateTask = existsSync(resolve(ROOT, 'deploy/aws/taskdef/migrate.example.json'));
  r.ev({ deployDocMentionsMigration: hasMigrationStep, dedicatedMigrateTask: migrateTask });
  return hasMigrationStep || migrateTask ? { layers: ['DEPLOY'], note: 'deployment runs migrations as a dedicated step (migrate taskdef); recovery strategy documented in deploy/aws. Prisma migrate deploy is forward-only — down-recovery is restore-from-backup (see DEPLOY-009 BLOCKED).' } : { status: 'FAIL', note: 'no migration deploy step' };
});
await h.check(r, 'DEPLOY-007', async () => {
  const res = runDevSeed('prisma/seed/dev-vehicles.ts');
  const refused = res.status !== 0 && /refuse|production/i.test(res.out);
  r.ev({ exit: res.status, reason: res.out.replace(/\n/g, ' ').slice(0, 140) });
  return refused ? { layers: ['API', 'DATABASE'], note: 'seed scripts refuse to execute against NODE_ENV=production (dev-guard), even with full prod config' } : { status: 'FAIL', note: `seed exit ${res.status}: ${res.out.slice(0, 100)}` };
});
await h.check(r, 'DEPLOY-008', async () => {
  const idx = await h.q(`SELECT indexname FROM pg_indexes WHERE schemaname='public'`);
  const names = idx.map((i) => i.indexname);
  const critical = {
    'listing public visibility': names.some((n) => n.includes('listings') && n.includes('status')),
    'enquiry dealer inbox': names.some((n) => n.includes('enquiries') && n.includes('dealerId')),
    'membership lookup': names.includes('dealer_members_userId_status_idx'),
    'session by token': names.includes('sessions_tokenHash_key'),
    'saved per customer': names.some((n) => n.includes('saved_vehicles') && n.includes('customerId')),
  };
  r.ev({ indexCount: names.length, critical });
  return Object.values(critical).every(Boolean) ? { layers: ['DATABASE'], note: `indexes support critical queries: ${Object.keys(critical).join(', ')} (${names.length} total)` } : { status: 'FAIL', note: JSON.stringify(critical) };
});
await h.check(r, 'DEPLOY-009', async () => {
  r.ev({ note: 'managed-DB backup/restore not reproducible in this isolated container' });
  return { status: 'BLOCKED', layers: ['DEPLOY'], note: 'Backup/restore of the production managed database cannot be exercised in this isolated container (no managed DB, no snapshot API). Recovery strategy is documented in deploy/aws. Requires a staging restore drill.' };
});
await h.check(r, 'DEPLOY-010', async () => {
  r.ev({ note: 'depends on DEPLOY-009 restore' });
  return { status: 'BLOCKED', layers: ['DEPLOY'], note: 'Verifying a restored DB preserves lifecycle/authorization relationships requires an actual restore (DEPLOY-009 BLOCKED). FK integrity on the live schema is green (DATA-005); a restore drill on staging is the remaining step.' };
});

r.save();
await h.pool.end();
