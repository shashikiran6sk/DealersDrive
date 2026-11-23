import { PromoError, canonicalUrl, mediaUrl } from './core.mjs';

async function body(response, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) throw new PromoError('SOURCE_LIMIT', 'Public response is too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export async function get(url, { image = false, fetcher = fetch } = {}) {
  const allowed = (u) =>
    image
      ? mediaUrl(u)
      : (() => {
          const v = new URL(u);
          if (
            v.protocol !== 'https:' ||
            v.hostname !== 'api.dealers-drive.com' ||
            v.port ||
            v.username ||
            v.password
          )
            throw new PromoError('INVALID_URL', 'Unexpected public API redirect.');
          return v.href;
        })();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      let target = allowed(url);
      for (let redirects = 0; redirects < 4; redirects++) {
        const r = await fetcher(target, {
          method: 'GET',
          redirect: 'manual',
          signal: AbortSignal.timeout(20000),
          headers: {
            Accept: image ? 'image/webp,image/jpeg,image/png' : 'application/json',
            'Cache-Control': 'no-cache',
          },
        });
        if ([301, 302, 303, 307, 308].includes(r.status)) {
          const next = r.headers.get('location');
          if (!next) throw new PromoError('SOURCE', 'Missing public redirect target.');
          target = allowed(new URL(next, target).href);
          await r.body?.cancel();
          continue;
        }
        if (r.status === 404 || r.status === 410)
          throw new PromoError(
            'UNAVAILABLE',
            'The public listing or image is no longer available.',
          );
        if (r.status === 429 || r.status >= 500)
          throw new Error(`Public source returned ${r.status}`);
        if (!r.ok) throw new PromoError('SOURCE', `Public source returned ${r.status}`);
        return await body(r, image ? 25 * 1024 * 1024 : 2 * 1024 * 1024);
      }
      throw new PromoError('SOURCE', 'Too many public redirects.');
    } catch (e) {
      if (e instanceof PromoError || attempt === 1) throw e;
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}
export async function listing(url) {
  const slug = canonicalUrl(url).split('/').at(-1);
  try {
    return JSON.parse(
      (
        await get('https://api.dealers-drive.com/v1/vehicles/' + encodeURIComponent(slug))
      ).toString(),
    );
  } catch (e) {
    if (e instanceof PromoError) throw e;
    // Network/server failures may fall back to the real page. Missing listings do not.
    const { chromium } = await import('playwright');
    let browser;
    try {
      try {
        browser = await chromium.launch({ headless: true });
      } catch {
        browser = await chromium.launch({ channel: 'chrome', headless: true });
      }
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      const data = await page.evaluate(() => {
        const main = document.querySelector('main') || document.body,
          text = main.innerText;
        const specs = [...main.querySelectorAll('dt')].map((d) => ({
          label: d.innerText.trim(),
          value: d.nextElementSibling?.innerText.trim() || '',
        }));
        const d = Object.fromEntries(specs.map((s) => [s.label, s.value]));
        const enabled = [...main.querySelectorAll('button')].some(
          (b) => b.innerText.trim() === 'Enquire now' && !b.disabled,
        );
        const images = [
          ...main.querySelectorAll(
            'button[aria-label^="Open photo "],button[aria-label^="Show photo "] img',
          ),
        ].map((i) => ({ url: i.src, alt: i.alt }));
        return {
          specs,
          images,
          d,
          text,
          enabled,
          title: main.querySelector('h1')?.innerText,
          location:
            main.querySelector('section[aria-labelledby="vdp-dealer-heading"] .min-w-0 p')
              ?.innerText || '',
        };
      });
      if (!data.specs.length || !data.images.length)
        throw new PromoError('SOURCE', 'The live page gallery/specification layout needs review.');
      return {
        slug,
        availability:
          data.enabled && !/reserved for another buyer|no longer available/i.test(data.text)
            ? 'AVAILABLE'
            : 'UNAVAILABLE',
        title: data.title,
        year: data.d['Manufacturing year'] ? Number(data.d['Manufacturing year']) : null,
        priceLabel: data.text.match(/DEALER PRICE\s+(₹[\d,]+)/)?.[1] || null,
        specs: data.specs,
        images: data.images,
        primaryIndex: 0,
        facts: {
          make: data.d.Make,
          model: data.d.Model,
          variant: data.d.Variant,
          fuelType: data.d.Fuel,
          transmission: data.d.Transmission,
          pricePaise: null,
          kilometersDriven: null,
          ownerCount: null,
        },
        dealer: { location: data.location },
      };
    } finally {
      await browser?.close();
    }
  }
}
