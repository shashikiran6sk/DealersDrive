import crypto from 'node:crypto';

export const SETTINGS = Object.freeze({
  duration: 20,
  fps: 60,
  formats: { vertical: { width: 1080, height: 1920 }, horizontal: { width: 1920, height: 1080 } },
});
export class PromoError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}
export const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
export function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, stable(value[k])]),
    );
  return value;
}
export const fingerprint = (value) => sha(JSON.stringify(stable(value)));
export function parseLoudness(log) {
  const blocks = [...log.matchAll(/\{\s*"input_i"\s*:[\s\S]*?\}/g)];
  if (!blocks.length) throw new PromoError('VERIFY', 'FFmpeg did not report audio loudness.');
  const result = JSON.parse(blocks.at(-1)[0]);
  if (!['input_i', 'input_tp', 'input_lra'].every((k) => Number.isFinite(Number(result[k]))))
    throw new PromoError('VERIFY', 'Invalid or silent audio loudness report.');
  return result;
}
export function canonicalUrl(input) {
  if (/\/(?:\.|%2e){1,2}(?:\/|$)/i.test(input.split(/[?#]/)[0]))
    throw new PromoError('INVALID_URL', 'Use a direct vehicle listing URL without dot segments.');
  let u;
  try {
    u = new URL(input);
  } catch {
    throw new PromoError('INVALID_URL', `Invalid listing URL: ${input}`);
  }
  if (
    u.protocol !== 'https:' ||
    !['dealers-drive.com', 'www.dealers-drive.com'].includes(u.hostname) ||
    u.port ||
    u.username ||
    u.password ||
    !/^\/car\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/.test(u.pathname)
  )
    throw new PromoError('INVALID_URL', 'Use an HTTPS Dealers-Drive /car/<slug> URL.');
  return 'https://www.dealers-drive.com' + u.pathname.replace(/\/$/, '');
}
export function parseUrls(values) {
  const tokens = values.flatMap((v) => v.trim().split(/[\s,]+/)).filter(Boolean);
  if (!tokens.length) throw new PromoError('INVALID_URL', 'Provide at least one car URL.');
  return [...new Set(tokens.map(canonicalUrl))];
}
export function mediaUrl(input) {
  const u = new URL(input);
  if (
    u.protocol !== 'https:' ||
    u.port ||
    u.username ||
    u.password ||
    !['api.dealers-drive.com', 'www.dealers-drive.com'].includes(u.hostname)
  )
    throw new PromoError('INVALID_MEDIA', 'The listing contains an unsupported public image host.');
  return u.href;
}
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const count = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
export function normalize(raw, inputUrl) {
  const url = canonicalUrl(inputUrl),
    slug = url.split('/').at(-1);
  if (
    !raw ||
    raw.slug !== slug ||
    !Array.isArray(raw.specs) ||
    !Array.isArray(raw.images) ||
    !raw.facts
  )
    throw new PromoError(
      'INVALID_DATA',
      'The public listing response does not match its URL or contract.',
    );
  if (typeof raw.availability !== 'string')
    throw new PromoError('INVALID_DATA', 'The listing has no availability status.');
  if (raw.availability !== 'AVAILABLE')
    throw new PromoError('UNAVAILABLE', `Listing status is ${raw.availability}.`);
  const specs = Object.fromEntries(
    raw.specs
      .filter((s) => s && typeof s.label === 'string' && typeof s.value === 'string')
      .map((s) => [s.label, s.value.trim()]),
  );
  const f = raw.facts,
    year = count(raw.year);
  if (raw.year !== null && raw.year !== undefined && year === null)
    throw new PromoError('INVALID_DATA', 'Invalid manufacturing year.');
  if (year && specs['Manufacturing year'] && String(year) !== specs['Manufacturing year'])
    throw new PromoError('INVALID_DATA', 'Conflicting manufacturing years.');
  const model = text(f.model) || text(specs.Model);
  if (!model) throw new PromoError('INVALID_DATA', 'The listing has no model identity.');
  const pricePaise = count(f.pricePaise);
  if (f.pricePaise !== null && f.pricePaise !== undefined && pricePaise === null)
    throw new PromoError('INVALID_DATA', 'Invalid asking price.');
  const km = count(f.kilometersDriven);
  if (f.kilometersDriven !== null && f.kilometersDriven !== undefined && km === null)
    throw new PromoError('INVALID_DATA', 'Invalid kilometres.');
  const priceLabel =
    text(raw.priceLabel) ||
    (pricePaise !== null
      ? '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(pricePaise / 100)
      : 'Price on request');
  if (
    pricePaise !== null &&
    /^₹[\d,.\s]+$/.test(priceLabel) &&
    Math.abs(Number(priceLabel.replace(/[^\d.]/g, '')) * 100 - pricePaise) > 0.5
  )
    throw new PromoError(
      'INVALID_DATA',
      'The asking price conflicts with its public display label.',
    );
  const priceLakh =
    pricePaise !== null && pricePaise % 100000 === 0 ? (pricePaise / 10000000).toFixed(2) : null;
  const ownerCount = count(f.ownerCount);
  const owners =
    text(specs.Owners) ||
    { 1: 'First owner', 2: 'Second owner', 3: 'Third owner' }[ownerCount] ||
    (ownerCount ? `${ownerCount} owners` : '');
  const images = raw.images.map((i) => ({ url: mediaUrl(i.url), alt: text(i.alt) }));
  if (!images.length)
    throw new PromoError('INVALID_DATA', 'No actual vehicle photographs are available.');
  const facts = {
    id: slug,
    slug,
    listingUrl: url,
    year: year || '',
    make: text(f.make) || text(specs.Make),
    model,
    variant: text(f.variant) || text(specs.Variant),
    fuel: text(f.fuelType) || text(specs.Fuel),
    transmission: text(f.transmission) || text(specs.Transmission),
    kilometres:
      km === null
        ? text(specs['Kilometres driven'])
        : new Intl.NumberFormat('en-IN').format(km) + ' km',
    owners,
    location: text(raw.dealer?.location) || text(raw.dealer?.city) || text(raw.dealer?.district),
    priceLabel,
    priceLakh,
    priceDisplay: priceLakh === null ? priceLabel : '₹' + priceLakh + ' lakh',
    availability: 'AVAILABLE',
  };
  return {
    facts,
    images,
    primaryIndex:
      Number.isInteger(raw.primaryIndex) &&
      raw.primaryIndex >= 0 &&
      raw.primaryIndex < images.length
        ? raw.primaryIndex
        : 0,
  };
}
export const ROLES = [
  'hero',
  'front',
  'rear',
  'side',
  'oppositeSide',
  'dashboard',
  'frontSeats',
  'rearSeats',
];
export function validatePlan(plan, capture) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan))
    throw new PromoError('PHOTO_PLAN', 'Photo roles must be an object.');
  const hashes = new Set(capture.images.map((i) => i.hash));
  for (const [role, hash] of Object.entries(plan)) {
    if (!ROLES.includes(role) || typeof hash !== 'string' || !hashes.has(hash))
      throw new PromoError('PHOTO_PLAN', `Unknown role or photograph: ${role}`);
  }
  if (!plan.hero) throw new PromoError('PHOTO_PLAN', 'Choose an actual exterior hero photograph.');
  return Object.fromEntries(ROLES.filter((r) => plan[r]).map((r) => [r, plan[r]]));
}
export function galleryKey(capture) {
  return fingerprint({
    primary: capture.images[capture.primaryIndex]?.hash,
    hashes: capture.images.map((i) => i.hash).sort(),
  });
}
export function inputKey(capture, plan, styleKey) {
  return fingerprint({
    facts: capture.facts,
    plan: validatePlan(plan, capture),
    styleKey,
    settings: SETTINGS,
  });
}
export function renderVehicle(capture, plan) {
  validatePlan(plan, capture);
  const byHash = new Map(capture.images.map((i) => [i.hash, i.file]));
  const photos = Object.fromEntries(Object.entries(plan).map(([r, h]) => [r, byHash.get(h)]));
  // Reuse an actual available view when coverage is sparse; never create an angle or cabin.
  for (const role of ['front', 'rear', 'side', 'oppositeSide']) photos[role] ||= photos.hero;
  return { ...capture.facts, photos };
}
