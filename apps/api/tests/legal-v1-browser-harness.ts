import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { writeFile } from 'node:fs/promises';

import { env } from '../src/config/env.js';
import { createSessionService } from '../src/modules/auth/session.service.js';
import { createAuthHarness, createFakeGoogle } from './auth-harness.js';
import { marketplaceFixtures } from './marketplace-fixtures.js';
import { submitDocumentSet } from './document-uploads.js';

const url = new URL(env.DATABASE_URL);
if (
  env.NODE_ENV !== 'test' ||
  env.APP_ENV !== 'local' ||
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  url.pathname !== '/dealersdrive_test_legal_browser' ||
  process.env.LEGAL_V1_PREVIEW !== 'true' ||
  env.PHONE_OTP_DRIVER !== 'fake'
) {
  throw new Error(
    'Browser harness requires local test database, fake OTP and explicit legal preview.',
  );
}
const adminUrl = new URL(url);
adminUrl.pathname = '/dealersdrive';
const admin = new pg.Client({ connectionString: adminUrl.toString() });
await admin.connect();
if (
  !(await admin.query("SELECT 1 FROM pg_database WHERE datname='dealersdrive_test_legal_browser'"))
    .rowCount
)
  await admin.query('CREATE DATABASE dealersdrive_test_legal_browser');
await admin.end();
execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: process.env,
});
const h = await createAuthHarness(createFakeGoogle());
await new Promise<void>((resolve) => h.server.close(() => resolve()));
await new Promise<void>((resolve) => h.server.listen(4191, '127.0.0.1', resolve));
const fixtures = marketplaceFixtures(h, `legal-browser-${Date.now()}`);
const draft = await fixtures.dealership('DRAFT');
await submitDocumentSet(draft.agent);
const approved = await fixtures.dealership('ACTIVE');
const customer = await h.prisma.user.create({
  data: {
    fullName: 'Local Review Customer',
    phone: `+9198${String(Date.now()).slice(-8)}`,
    phoneVerifiedAt: new Date(),
  },
});
const store = createSessionService(h.prisma);
const customerSession = await store.issue({ userId: customer.id, scope: 'CUSTOMER' });
const draftSession = await store.issue({ userId: draft.userId, scope: 'DEALER' });
const approvedSession = await store.issue({ userId: approved.userId, scope: 'DEALER' });
await writeFile(
  '/tmp/dealers-drive-legal-browser.json',
  JSON.stringify({
    customer: customerSession.token,
    draft: draftSession.token,
    approved: approvedSession.token,
  }),
  { mode: 0o600 },
);
process.stdout.write(
  'Local legal browser API ready on 127.0.0.1:4191; only synthetic local test accounts.\n',
);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    void h.close().then(() => process.exit(0));
  });
