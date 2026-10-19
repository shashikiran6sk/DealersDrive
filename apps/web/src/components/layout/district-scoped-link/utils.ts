const DISTRICT_SLUG = /^[a-z0-9-]+$/;

export function scopedHref(href: string, district: string | null): string {
  if (!district || !DISTRICT_SLUG.test(district)) return href;
  const [path = '', query = ''] = href.split('?', 2);
  const params = new URLSearchParams(query);
  params.set('district', district);
  return `${path}?${params.toString()}`;
}
