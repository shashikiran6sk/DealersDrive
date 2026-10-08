export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
export function sitemapXml(entries: readonly { url: string; lastModified?: string }[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map((entry) => `<url><loc>${xmlEscape(entry.url)}</loc>${entry.lastModified ? `<lastmod>${xmlEscape(entry.lastModified)}</lastmod>` : ''}</url>`).join('')}</urlset>`;
}
export function sitemapIndexXml(urls: readonly string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<sitemap><loc>${xmlEscape(url)}</loc></sitemap>`).join('')}</sitemapindex>`;
}
