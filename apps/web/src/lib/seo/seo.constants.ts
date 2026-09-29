export const SITE_NAME = 'Dealers-Drive';

export const SITE_LOCALE = 'en_IN';

export const TITLE_SEPARATOR = ' | ';

export const TITLE_TEMPLATE = `%s${TITLE_SEPARATOR}${SITE_NAME}`;

export const HOME_TITLE = `${SITE_NAME}${TITLE_SEPARATOR}Used Cars from Verified Independent Dealers`;

export const SITE_DESCRIPTION =
  'Browse used cars from verified independent dealers on Dealers-Drive. Search by brand, model and district, and enquire directly with the dealership that owns the car.';

export const DEFAULT_SOCIAL_IMAGE = {
  path: '/og/dealers-drive.png',
  width: 1200,
  height: 630,
  alt: 'Dealers-Drive — used cars from verified independent dealers',
} as const;

export const LOGO_PATH = '/icon.png';

export const LOGO_SIZE = 512;

export const DEFAULT_ORIGIN = 'http://localhost:3000';

export const LOCAL_HOSTS: ReadonlySet<string> = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
]);

export const PREVIEW_HOST_SUFFIXES: readonly string[] = ['.vercel.app'];

export const DISALLOWED_PATHS: readonly string[] = ['/api/', '/v1/'];

export const SITEMAP_PATH = '/sitemap.xml';

export const PAGE_PARAM = 'page';

export const DISTRICT_PARAM = 'district';

export const BREADCRUMB_TEXT = {
  home: 'Home',
  cars: 'Cars',
  dealers: 'Dealers',
} as const;

export const SCHEMA_ORG = 'https://schema.org';

export const COUNTRY_CODE = 'IN';

export const CURRENCY = 'INR';

export const KILOMETRE_UNIT = 'KMT';

export const SUPPORT_CONTACT_TYPE = 'customer support';

export const NOT_A_PROFILE_NETWORKS: ReadonlySet<string> = new Set(['whatsapp']);
