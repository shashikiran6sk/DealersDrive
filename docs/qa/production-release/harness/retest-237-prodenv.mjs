// PR #237 independent production-config probe against the API source on the current checkout.
import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as h from './lib.mjs';
const r = h.recorder('retest-237-prodenv');
const REPO = h.REPO;
const TSX = createRequire(`${REPO}/apps/api/package.json`).resolve('tsx/cli');
const PROBE = `${REPO}/apps/api/.cert-env-probe.mts`;
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
await h.check(r, 'R237-ORIG-BUG-001-default-signing-secret-in-production', async () => {
  // After #241 the signed stand-ins are mounted only for STORAGE_DRIVER=local, which a
  // production environment refuses (case `local` above). The default secret is therefore
  // unused under r2; the forged-signature surface itself is probed as SEC-DISC-001a–c.
  const { readFileSync } = await import('node:fs');
  const routes = readFileSync(`${REPO}/apps/api/src/modules/media/media.routes.ts`, 'utf8');
  const localOnly = /driver === 'local' \? \[\.\.\.LOCAL_STAND_INS/.test(routes);
  const defaultUnderR2 = cases.r2WithEndpoint.ok?.signingSecretIsDefault === true;
  r.ev({
    standInsLocalOnly: localOnly,
    defaultSecretUnderR2: defaultUnderR2,
    localRefusedInProduction: cases.local.code !== 0,
  });
  return localOnly && cases.local.code !== 0
    ? {
        note: `stand-ins mounted only for the local driver and production refuses local; default secret under r2 ${defaultUnderR2 ? 'present but unused' : 'replaced'}`,
      }
    : {
        status: 'FAIL',
        note: `stand-ins local-only ${localOnly}; local refused ${cases.local.code !== 0}`,
      };
});
r.save();
rmSync(PROBE, { force: true });
