import { z } from 'zod';

/**
 * Shapes that are not specific to one resource: identifiers, pagination,
 * the error envelope, and the formatted-value pairs the API returns so the
 * four surfaces that show a price cannot disagree about Lakh rounding
 * (API-SPEC §0.4).
 */

export const Uuid = z.string().uuid();

export const IdParam = z.object({ id: Uuid }).strict();
export type IdParam = z.infer<typeof IdParam>;

export const SlugParam = z.object({ slug: z.string().min(1).max(120) }).strict();
export type SlugParam = z.infer<typeof SlugParam>;

export const IdOrSlugParam = z.object({ idOrSlug: z.string().min(1).max(160) }).strict();
export type IdOrSlugParam = z.infer<typeof IdOrSlugParam>;

/** Offset pagination — public search only, because SEO needs linkable pages. */
export const OffsetPage = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});
export type OffsetPage = z.infer<typeof OffsetPage>;

/** Cursor pagination — dealer and admin lists, stable under concurrent inserts. */
export const CursorPage = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
export type CursorPage = z.infer<typeof CursorPage>;

export const CursorQuery = z
  .object({
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type CursorQuery = z.infer<typeof CursorQuery>;

/** RFC 9457. `code` is the machine-readable contract; `detail` never is. */
export const ProblemDetails = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  code: z.string(),
  traceId: z.string().optional(),
  requestId: z.string().optional(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  errors: z
    .array(z.object({ field: z.string(), code: z.string(), message: z.string() }))
    .optional(),
});
export type ProblemDetails = z.infer<typeof ProblemDetails>;

export const KeyValue = z.object({ key: z.string(), label: z.string(), value: z.string() });
export type KeyValue = z.infer<typeof KeyValue>;

export const ImageRef = z.object({
  url: z.string(),
  srcset: z.string(),
  blurhash: z.string().nullable(),
  alt: z.string(),
});
export type ImageRef = z.infer<typeof ImageRef>;

/**
 * India-facing formatting. All of it lives here rather than in either app,
 * because DESIGN-SPEC §4.14 fixes the exact forms and a second implementation
 * is a second set of rounding rules.
 */

/** `64500000` paise -> `₹6.45 Lakh`. Two decimals, always (DESIGN-SPEC §4.14). */
export function formatLakh(paise: bigint | number): string {
  const rupees = Number(paise) / 100;
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(2)} Cr`;
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(2)} Lakh`;
  return `₹${Math.round(rupees).toLocaleString('en-IN')}`;
}

/** `1000000` paise -> `₹10,000`. For invoices, packs and other exact amounts. */
export function formatRupees(paise: bigint | number): string {
  return `₹${Math.round(Number(paise) / 100).toLocaleString('en-IN')}`;
}

/** `42180` -> `42,180 km`. */
export function formatKm(km: number): string {
  return `${km.toLocaleString('en-IN')} km`;
}

/**
 * `2026-08-02T…` -> `02 Aug 2026`.
 *
 * The month names are a literal table rather than `toLocaleString`, which
 * renders September as "Sept" under current ICU and would put a four-letter
 * month in a column the design sizes for three.
 */
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function formatDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${day} ${MONTHS[date.getUTCMonth()] ?? ''} ${date.getUTCFullYear()}`;
}

/** `Mar 2027` — the insurance-validity form on the VDP spec table. */
export function formatMonthYear(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${MONTHS[date.getUTCMonth()] ?? ''} ${date.getUTCFullYear()}`;
}

/**
 * `+919840012345` -> `+91 98400 12345`.
 *
 * An empty input returns an empty string rather than a bare `+91`. Several
 * responses legitimately carry `phone: ''` — a dealership with no contact number
 * on file yet — and pairing that with `phoneDisplay: '+91'` renders a country
 * code next to a `tel:` link that dials nothing.
 */
export function formatPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (digits.length === 0) return '';
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`.trimEnd();
}

/** Any Indian input -> E.164. Bare 10-digit numbers get the +91 they omitted. */
export function toE164(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return `+${digits}`;
}

/** "Sri Lakshmi Motors" -> "SL". Two letters, always, for the square avatar. */
export function initialsOf(name: string): string {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean);
  const first = words[0]?.[0] ?? '?';
  const second = words[1]?.[0] ?? words[0]?.[1] ?? '';
  return `${first}${second}`.toUpperCase();
}

/** Indicative EMI: 85% financed, 9.5% p.a., 60 months. Shown, never charged. */
export function emiPaise(pricePaise: bigint | number): number {
  const principal = Number(pricePaise) * 0.85;
  const monthlyRate = 0.095 / 12;
  const months = 60;
  const factor = Math.pow(1 + monthlyRate, months);
  return Math.round((principal * monthlyRate * factor) / (factor - 1));
}

/** "18 min ago" / "2 days ago" — the only relative form the design uses. */
export function timeAgo(value: Date | string, now: Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return formatDate(date);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** The longest slug `SlugParam` will carry back in. */
const DEALER_SLUG_MAX = 120;

/**
 * How long the trading name may be before the place is appended.
 *
 * The location suffix is the whole point of the slug's shape — it is what a
 * person reads in a bucket listing and in a portfolio URL — so it must survive
 * a dealership with a very long registered name rather than be truncated off
 * the end.
 */
const DEALER_SLUG_NAME_MAX = 60;

/**
 * `sri-lakshmi-motors-katpadi-vellore-tamil-nadu`.
 *
 * The dealership's address is *in* its slug, and that is deliberate on two
 * counts. It is the public portfolio's URL, where a place name is the strongest
 * signal a buyer and a search engine both read; and it is the name of the
 * dealership's folder in object storage, which is otherwise a UUID nobody can
 * identify while looking at a bucket.
 *
 * ## The slug is assigned once and never recomputed
 *
 * It is written at registration, out of the address given there, and no write
 * path changes it afterwards — not a rename, not a move. Two things depend on
 * that: a portfolio URL a dealer has printed on a banner keeps working, and
 * every KYC document's storage key is *derived* from the slug rather than
 * stored, so a slug that changed underneath them would orphan the files.
 *
 * The one thing permitted to change a slug is therefore
 * `apps/api/scripts/relocate-dealer-storage.ts`, which moves the objects in the
 * same pass.
 *
 * Consecutive duplicate segments collapse, because across India a city and its
 * district share a name far more often than not — Vellore city sits in Vellore
 * district — and `…-vellore-vellore-tamil-nadu` reads like a bug.
 */
export function dealerSlug(parts: {
  legalName: string;
  city?: string | null;
  district?: string | null;
  state?: string | null;
}): string {
  const name =
    slugify(parts.legalName).slice(0, DEALER_SLUG_NAME_MAX).replace(/-+$/, '') || 'dealership';

  const place: string[] = [];
  for (const part of [parts.city, parts.district, parts.state]) {
    const segment = part ? slugify(part) : '';
    if (!segment || place[place.length - 1] === segment) continue;
    place.push(segment);
  }

  return [name, ...place].join('-').slice(0, DEALER_SLUG_MAX).replace(/-+$/, '');
}

/**
 * `" VELLORE "` -> `"Vellore"`, `"tamil  nadu"` -> `"Tamil Nadu"`.
 *
 * The guard rail that free-text city and state need. CLAUDE.md §5 records the
 * risk in the vehicle catalogue's own words — without a lookup table,
 * `Maruti`, `Maruti Suzuki` and `MARUTI SUZUKI INDIA LTD` become three facets
 * of one brand — and a locality typed by five thousand dealers fragments the
 * same way: `vellore`, `Vellore` and `VELLORE ` are one city filtered three
 * ways.
 *
 * So normalisation happens at **write time**, here, in the package both apps
 * import, rather than at read time in whichever query happens to remember. It
 * is deliberately conservative: case and whitespace only. It does not correct
 * spelling, expand abbreviations or transliterate, because each of those would
 * be a judgement about a place name that a dealer knows better than we do.
 */
export function normaliseLocality(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(
      /(^|[\s\-'.])(\p{L})/gu,
      (_match, lead: string, letter: string) => lead + letter.toUpperCase(),
    );
}

/**
 * `["Finance", " finance ", "RC transfer"]` -> `["Finance", "RC transfer"]`.
 *
 * The same guard rail as `normaliseLocality`, for the same reason and applied
 * at the same moment. A dealership's services are free text typed into one
 * comma-separated box, and "Finance, finance" is a slip nobody makes on
 * purpose — but two entries that differ only in case are two facets of one
 * service to a filter, two chips on a card, and two React children with the
 * same `key`, which is what surfaced this: the public page renders a tag per
 * service and keys it by the string.
 *
 * The rules are deliberately narrow:
 *
 *   · entries are compared **case-insensitively**, with internal whitespace
 *     collapsed, because that is the difference a typo makes
 *   · the **first** spelling wins, so a dealer who wrote "RC Transfer" keeps
 *     their capitals rather than having ours imposed
 *   · order is preserved, because the dealer chose it and the card shows the
 *     first three
 *
 * It does not correct spelling, merge synonyms or singularise. "Loan" and
 * "Loans" stay two services: a dealer knows what they offer, and a function
 * that guesses would eventually be wrong in a way nobody could see.
 */
export function distinctServices(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];

  for (const value of values) {
    const service = value.trim().replace(/\s+/g, ' ');
    if (!service) continue;

    const key = service.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    kept.push(service);
  }

  return kept;
}

/**
 * A ten-digit Indian mobile number, however it was typed.
 *
 * One definition, in the package both apps import, because there were three
 * before: the onboarding schema, the profile schema and the wizard's own
 * browser-side check. Three copies of a regex is three chances to disagree
 * about whether `98400 12345` is a phone number — and they did disagree with
 * the placeholder in the form, which shows exactly that spacing.
 *
 * Separators are stripped before the test rather than enumerated in it. People
 * type `+91 98400 12345`, `98400-12345` and `9840012345`, all of them meaning
 * the same number, and `toE164` reduces every one of them to `+919840012345`
 * on the way to the column. A validator that rejects two of the three is
 * rejecting a formatting habit, not a wrong number.
 */
export function isIndianMobile(value: string): boolean {
  return /^(\+?91)?[6-9]\d{9}$/.test(value.trim().replace(/[\s-]/g, ''));
}

export const IndianMobile = z
  .string()
  .trim()
  .max(20)
  .refine(isIndianMobile, 'Enter a 10-digit Indian mobile number.');

/**
 * The hosts a Google Maps link may point at.
 *
 * The dealer pastes this and a **buyer's browser follows it**, which is the
 * whole reason it is checked against a list rather than accepted as any URL.
 * An unvalidated link stored here would be a self-service open redirect with a
 * dealership's name on it: the "Get directions" button on a portfolio page is
 * exactly the button somebody clicks without reading the status bar.
 *
 * Both shapes Google itself hands out are here — the long `google.com/maps/…`
 * URL from the address bar and the `maps.app.goo.gl/…` shortener the Share
 * sheet produces on a phone, which is what most dealers will paste. The
 * country domains are the ones an Indian dealer's browser actually produces.
 */
const MAPS_HOSTS = new Set([
  'google.com',
  'www.google.com',
  'google.co.in',
  'www.google.co.in',
  'maps.google.com',
  'maps.google.co.in',
  'maps.app.goo.gl',
  'goo.gl',
]);

/**
 * The link out of whatever the dealer actually pasted.
 *
 * Google offers a dealer three things that all look like "the link to my
 * business", and they will paste any of them:
 *
 *   · the **share link** — `maps.app.goo.gl/…`, one tap on a phone;
 *   · the **embed URL** — `google.com/maps/embed?pb=…`, from Share → Embed;
 *   · the whole **`<iframe>`**, which is what that panel actually copies, and
 *     what a "how to put a map on your website" tutorial tells them to take.
 *
 * The first two are already URLs. The third is a fragment of HTML with a URL
 * inside it, and refusing it with "that is not a Google Maps link" is telling
 * somebody that the thing Google just handed them is not the thing Google just
 * handed them. So the `src` is lifted out and the rest is discarded — the HTML
 * is never stored, and what comes out the other side is a URL that then faces
 * exactly the same host check as any other.
 *
 * Deliberately narrow: the first `src="…"` or `src='…'` of an `<iframe>`, and
 * nothing else. This is not an HTML parser and must not become one.
 */
export function mapsUrlFrom(input: string): string {
  const value = input.trim();
  if (!/^<iframe[\s>]/i.test(value)) return value;

  const src = /\ssrc\s*=\s*["']([^"']+)["']/i.exec(value);
  // A malformed paste falls through as-is, so the schema below refuses it with
  // its own message rather than this returning something that looks like a URL.
  return src?.[1]?.trim() ?? value;
}

/**
 * A Google Maps link to the dealership's yard, as the dealer pasted it.
 *
 * Stored verbatim rather than parsed into coordinates — `mapsUrlFrom` only
 * unwraps an `<iframe>`, it never rewrites a URL. A share link survives the
 * dealer moving the pin, carries the place's own name and reviews, and opens
 * the Google Maps app on a phone rather than a web map, none of which a
 * `lat,lng` pair would do. The coordinates are read out of it *as well*, at
 * write time, for the map the portfolio draws (**R10**).
 *
 * `https` only: the link is rendered as an anchor on a public page, and a
 * plaintext hop is a downgrade a buyer cannot see.
 */
export const GoogleMapsUrl = z
  .preprocess(
    (value) => (typeof value === 'string' ? mapsUrlFrom(value) : value),
    z
      .string()
      .trim()
      .url('Paste the link Google Maps gave you.')
      .max(2048)
      .refine(
        isGoogleMapsUrl,
        'That is not a Google Maps link. Open your yard in Google Maps, tap Share, and paste the link it gives you.',
      ),
  )
  // The preprocess makes the schema's input `unknown`, and every caller sends a
  // string. Restated so the inferred type, and the generated reference, still
  // say so.
  .pipe(z.string());

/**
 * `https:` and a hostname on the list above.
 *
 * Exported as a predicate, not only as a schema, because the schema checks the
 * link the *dealer typed* and something else has to check every hop after it.
 * A `maps.app.goo.gl` share link is a redirect, and the API follows it to
 * recover the yard's coordinates — so each `Location` it is handed is a URL
 * chosen by Google rather than by the schema, and a redirect to
 * `http://169.254.169.254/` is a request the server would otherwise make on
 * somebody else's behalf. One predicate, applied at every hop.
 */
export function isGoogleMapsUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && MAPS_HOSTS.has(url.hostname.toLowerCase());
}
