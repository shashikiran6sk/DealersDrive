import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire('/Users/shashikiran/Development/dealers-drive/apps/api/package.json');
const { Client } = require('pg');
const url = new URL(process.env.DATABASE_URL);
if (
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  url.port !== '5432' ||
  url.pathname !== '/dealersdrive'
) {
  throw new Error('Read-only inventory is restricted to the verified local development database.');
}
const client = new Client({
  connectionString: url.toString(),
  options: '-c default_transaction_read_only=on',
});
await client.connect();
try {
  const { rows } = await client.query(`
    WITH identities AS (
      SELECT d.id, lower(regexp_replace(coalesce(g.email, u.email, d."contactEmail"), '^[[:space:]]+|[[:space:]]+$', '', 'g')) AS email
      FROM dealers d
      LEFT JOIN dealer_members m ON m."dealerId" = d.id AND m.role = 'OWNER' AND m.status = 'ACTIVE'
      LEFT JOIN users u ON u.id = m."userId"
      LEFT JOIN LATERAL (SELECT email FROM oauth_identities WHERE "userId" = u.id
        AND provider = 'GOOGLE' AND "emailVerified" = true ORDER BY "createdAt", id LIMIT 1) g ON true
    )
    SELECT
      (SELECT count(*)::int FROM dealers) AS "dealerRows",
      (SELECT count(*)::int FROM (SELECT lower(btrim(email)) FROM users WHERE nullif(btrim(email), '') IS NOT NULL GROUP BY lower(btrim(email)) HAVING count(*) > 1) x) AS "canonicalUserConflictGroups",
      (SELECT count(*)::int FROM (SELECT "dealerId" FROM dealer_members WHERE role = 'OWNER' AND status = 'ACTIVE' GROUP BY "dealerId" HAVING count(*) > 1) x) AS "multipleActiveOwnerGroups",
      (SELECT count(*)::int FROM (SELECT email FROM identities WHERE nullif(email, '') IS NOT NULL GROUP BY email HAVING count(*) > 1) x) AS "primaryDealerConflictGroups"
  `);
  const report = {
    environment: 'verified local development PostgreSQL; read-only session',
    productionAccess: false,
    capturedAt: new Date().toISOString(),
    ...rows[0],
  };
  const out =
    '/tmp/dd-campaign-evidence/docs/testing/implementation-campaign/pr-02-email-uniqueness';
  await mkdir(out, { recursive: true });
  await writeFile(`${out}/legacy-audit.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await client.end();
}
