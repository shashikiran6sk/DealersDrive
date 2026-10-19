// PR #237 independent production-config probe against the API source on the current checkout.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import * as h from './lib.mjs';
const r = h.recorder('retest-237-prodenv');
const REPO = '/home/user/DealersDrive';
const TSX = `${REPO}/node_modules/.pnpm/tsx@4.23.13/node_modules/tsx/dist/cli.mjs`;
const PROBE = '/tmp/env-probe.mts';
writeFileSync(
  PROBE,
  `const m = await import('${REPO}/apps/api/src/config/env.ts');\nconsole.log('OK ' + JSON.stringify({ storage: m.env.STORAGE_DRIVER, endpoint: m.env.S3_ENDPOINT, signingSecretIsDefault: m.env.UPLOAD_SIGNING_SECRET === 'dealers-drive-local-upload-secret' }));\n`,
);
const PROD = {
  NODE_ENV: 'production',
  APP_ENV: 'production',
  WEB_ORIGIN: 'https://dealers-drive.com',
  WEB_BASE_URL: 'https://dealers-drive.com',
  API_BASE_URL: 'https://api.dealers-drive.com',
  MEDIA_BASE_URL: 'https://api.dealers-drive.com/media',
  DATABASE_URL: 'postgresql://u:p@db.internal:5432/prod',
  GOOGLE_CLIENT_ID: 'x',
  GOOGLE_CLIENT_SECRET: 'y',
  SESSION_SECRET: 'a-very-long-production-session-secret-value-123',
  STORAGE_DRIVER: 'r2',
  S3_ACCESS_KEY_ID: 'k',
  S3_SECRET_ACCESS_KEY: 's',
  MAIL_DRIVER: 'resend',
  RESEND_API_KEY: 're_x',
  MAIL_FROM: 'Dealers-Drive <updates@dealers-drive.com>',
  PHONE_OTP_DRIVER: 'msg91',
  MSG91_AUTH_KEY: 'k',
  MSG91_WIDGET_ID: 'w',
  MSG91_WIDGET_TOKEN: 't',
  CACHE_DRIVER: 'postgres',
  AUTH_MODE: 'cookie',
  DOCS_ENABLED: 'false',
};
function probe(overrides, drop = []) {
  const env = { PATH: process.env.PATH, ...PROD, ...overrides };
  for (const k of drop) delete env[k];
  const res = spawnSync(process.execPath, [TSX, PROBE], {
    env,
    encoding: 'utf8',
    cwd: `${REPO}/apps/api`,
  });
  const out = (res.stdout || '') + (res.stderr || '');
  const ok = out.match(/^OK (.*)$/m);
  return {
    code: res.status,
    ok: ok ? JSON.parse(ok[1]) : null,
    reason: (out.match(/STORAGE_DRIVER[^\n]*/) || [''])[0],
  };
}
const cases = {
  r2WithEndpoint: probe({ S3_ENDPOINT: 'https://acct.r2.cloudflarestorage.com' }),
  minio: probe({ STORAGE_DRIVER: 'minio' }),
  local: probe({ STORAGE_DRIVER: 'local' }),
  r2NoEndpoint: probe({}, ['S3_ENDPOINT']),
  r2LoopbackEndpoint: probe({ S3_ENDPOINT: 'http://127.0.0.1:9000' }),
};
r.ev(cases);
await h.check(r, 'R237-PROD-002-minio-and-local-refused', async () => {
  h.assert(
    cases.r2WithEndpoint.code === 0,
    `valid r2 env refused: ${JSON.stringify(cases.r2WithEndpoint)}`,
  );
  h.assert(
    cases.minio.code !== 0 && /r2/.test(cases.minio.reason),
    `minio ${JSON.stringify(cases.minio)}`,
  );
  h.assert(cases.local.code !== 0, `local ${JSON.stringify(cases.local)}`);
  return {
    note: `production: r2 boots; minio refused (${cases.minio.reason.trim()}); local refused`,
  };
});
await h.check(r, 'R237-BUG-NEW-013-r2-endpoint-unvalidated', async () =>
  cases.r2NoEndpoint.code === 0 && cases.r2LoopbackEndpoint.code === 0
    ? {
        status: 'FAIL',
        note: `production r2 boots with S3_ENDPOINT omitted (resolves to ${cases.r2NoEndpoint.ok.endpoint}) and with a loopback endpoint (${cases.r2LoopbackEndpoint.ok.endpoint}) — BUG-NEW-013 confirmed`,
      }
    : { note: `omitted ${cases.r2NoEndpoint.code}, loopback ${cases.r2LoopbackEndpoint.code}` },
);
await h.check(r, 'R237-ORIG-BUG-001-default-signing-secret-in-production', async () =>
  cases.r2WithEndpoint.ok?.signingSecretIsDefault
    ? {
        status: 'FAIL',
        note: 'a production r2 env without UPLOAD_SIGNING_SECRET boots with the committed default secret; /uploads (PUT) and /private (GET) are mounted for every driver and backed by the configured StoragePort — forged signatures would write/read the production bucket. ORIG-BUG-001 remains P0.',
      }
    : { note: 'default signing secret refused or replaced in production' },
);
r.save();
