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

export const CityRef = z.object({
  slug: z.string(),
  name: z.string(),
  state: z.string().optional(),
});
export type CityRef = z.infer<typeof CityRef>;

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
