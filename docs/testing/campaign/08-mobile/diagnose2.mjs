import * as b from '../../certification/harness/bkit.mjs';
import * as h from '../../certification/harness/lib.mjs';
const admin = await h.admin('cert-admin@example.test');
const d = await h.one(`SELECT id FROM dealers WHERE "legalName" ILIKE 'OverflowDetail%' ORDER BY "createdAt" DESC LIMIT 1`);
const ctx = await b.context({ cookie: admin.cookie, viewport: { width: 320, height: 900 } });
const p = await ctx.newPage();
await p.goto(`${b.WEB}/admin/dealers/${d.id}`, { waitUntil: 'networkidle' });
console.log(await p.evaluate(() => {
  const t = [...document.querySelectorAll('span.tag-warn')].find((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5);
  const chain = [];
  for (let e = t; e && e !== document.body && chain.length < 7; e = e.parentElement)
    chain.push(`${e.tagName}.${(e.className?.toString?.() ?? '').slice(0, 110)} w=${Math.round(e.getBoundingClientRect().width)} r=${Math.round(e.getBoundingClientRect().right)} | ${(e.textContent ?? '').trim().slice(0, 60)}`);
  return chain.join('\n');
}));
await b.close(); process.exit(0);
