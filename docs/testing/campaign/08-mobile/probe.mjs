// BUG-NEW-006 + ADMIN-MOBILE-DETAIL-001: horizontal overflow at phone widths.
// Onboarding account step for a dealer whose Google email is long; Admin dealer
// detail for a dealership whose maps URL and email are long. Writes a sanitized
// summary (widths only) and, with PROBE_SHOTS=1, one screenshot per page at 320.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as b from '../../certification/harness/bkit.mjs';
import * as h from '../../certification/harness/lib.mjs';
import * as w from '../../certification/harness/world.mjs';

const label = process.env.PROBE_LABEL ?? 'run';
const out = process.env.CERT_RESULTS_DIR ?? '.';
const longEmail = `a.very.long.dealer.mailbox.name.for.overflow.${h.nonce()}@example-dealership-group.test`;

const onboarding = await h.dealerPhone('Overflow Owner');
await h.simulateGoogleLink(onboarding.userId, longEmail);

const admin = await h.admin('cert-admin@example.test');
const D = await w.onboard('OverflowDetail');
await h.q(
  `UPDATE dealers SET "mapsUrl"=$2, "contactEmail"=$3 WHERE id=$1`,
  [
    D.dealerId,
    'https://www.google.com/maps/place/Overflow+Motors+Yard/@12.9715987,79.1588,17z/data=!3m1!4b1!4m6!3m5!1s0x3bad38e61fa68ffb',
    longEmail,
  ],
);

async function measure(cookie, path, width) {
  const ctx = await b.context({ cookie, viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${b.WEB}${path}`, { waitUntil: 'networkidle' });
  const facts = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  if (process.env.PROBE_SHOTS === '1' && width === 320) {
    const name = path.startsWith('/admin') ? 'admin-detail' : 'onboarding';
    await page.screenshot({ path: resolve(out, `${label}-${name}-320.png`), fullPage: false });
  }
  await ctx.close();
  return { width, overflow: facts.scrollWidth - facts.clientWidth };
}

const results = [];
for (const width of [320, 360, 390, 768]) {
  results.push({ page: 'onboarding', ...(await measure(onboarding.cookie, '/dealer/onboarding', width)) });
  results.push({ page: 'admin-detail', ...(await measure(admin.cookie, `/admin/dealers/${D.dealerId}`, width)) });
}
const summary = { label, results, verdict: results.every((r) => r.overflow <= 0) ? 'PASS' : 'FAIL' };
console.log(JSON.stringify(summary, null, 1));
writeFileSync(resolve(out, `probe-${label}.json`), JSON.stringify(summary, null, 2) + '\n');
await b.close();
process.exit(0);
