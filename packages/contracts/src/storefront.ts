import { z } from 'zod';

import { GoogleMapsUrl, IndianMobile, OffsetPage, Uuid, toE164 } from './common.js';
import { DealerVehicleQuery, PublicVehicleDetail, VehicleCardDto } from './public.js';

export const STOREFRONT_RESERVED_SLUGS = [
  'www',
  'api',
  'admin',
  'auth',
  'mail',
  'support',
  'dashboard',
  'static',
  'media',
  'assets',
  'app',
  'localhost',
  'dev',
  'preview',
  'staging',
  'production',
  'storefront',
  'dealer',
  'dealers',
  'cars',
  'car',
  'sales',
  'internal',
  'health',
  'status',
  'cdn',
  'uploads',
  'billing',
  'payments',
  'help',
  'legal',
  'privacy',
  'terms',
  'account',
  'login',
  'register',
  'smtp',
  'imap',
  'pop',
  'ftp',
  'ns1',
  'ns2',
] as const;

export const StorefrontSlug = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lower-case letters, numbers and single hyphens.')
  .refine(
    (value) => !STOREFRONT_RESERVED_SLUGS.some((name) => name === value),
    'This name is reserved.',
  );

export const StorefrontHostname = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
    'Enter a hostname without a scheme, path, port or wildcard.',
  )
  .refine(
    (value) => !value.split('.').some((label) => label.startsWith('xn--')),
    'Internationalized hostnames are not supported in V1.',
  )
  .refine(
    (value) =>
      !['localhost', 'local', 'internal', 'invalid', 'test'].some((suffix) =>
        value.endsWith(`.${suffix}`),
      ),
    'Use a public hostname.',
  );

export const StorefrontTheme = z.enum(['LIGHT', 'DARK']);
export type StorefrontTheme = z.infer<typeof StorefrontTheme>;
export const StorefrontStatus = z.enum([
  'DRAFT',
  'PENDING_ACTIVATION',
  'ACTIVE',
  'SUSPENDED',
  'DISABLED',
]);
export type StorefrontStatus = z.infer<typeof StorefrontStatus>;
export const StorefrontDomainStatus = z.enum([
  'PENDING',
  'VERIFICATION_REQUIRED',
  'ACTIVE',
  'FAILED',
  'REMOVAL_PENDING',
  'REMOVED',
]);
export type StorefrontDomainStatus = z.infer<typeof StorefrontDomainStatus>;

export const STOREFRONT_TRANSITIONS: Record<StorefrontStatus, readonly StorefrontStatus[]> = {
  DRAFT: ['PENDING_ACTIVATION', 'DISABLED'],
  PENDING_ACTIVATION: ['ACTIVE', 'DISABLED', 'SUSPENDED'],
  ACTIVE: ['DISABLED', 'SUSPENDED'],
  SUSPENDED: ['PENDING_ACTIVATION', 'DISABLED'],
  DISABLED: ['PENDING_ACTIVATION'],
};

export function canTransitionStorefront(from: StorefrontStatus, to: StorefrontStatus): boolean {
  return from === to || STOREFRONT_TRANSITIONS[from].includes(to);
}

export function effectiveStorefrontStatus(
  status: StorefrontStatus,
  dealerStatus: string,
): StorefrontStatus {
  return dealerStatus === 'ACTIVE' ? status : 'SUSPENDED';
}

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (value) =>
        !/[<>]/.test(value) &&
        [...value].every((char) => {
          const code = char.charCodeAt(0);
          return code >= 32 || code === 9 || code === 10 || code === 13;
        }),
      'Use plain text.',
    );
export const StorefrontAccent = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((value) => value.toLowerCase());
export const StorefrontSocialUrl = z
  .string()
  .trim()
  .max(500)
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.username === '' &&
      url.password === '' &&
      url.port === '' &&
      [
        'instagram.com',
        'www.instagram.com',
        'facebook.com',
        'www.facebook.com',
        'youtube.com',
        'www.youtube.com',
        'linkedin.com',
        'www.linkedin.com',
        'x.com',
        'www.x.com',
      ].includes(url.hostname.toLowerCase())
    );
  }, 'Use an HTTPS URL on a supported social network.');

export const StorefrontBrandingInput = z
  .object({
    displayName: text(100).min(2).optional(),
    theme: StorefrontTheme.optional(),
    accentColor: StorefrontAccent.optional(),
    headline: text(140).optional(),
    description: text(500).optional(),
    about: text(3000).optional(),
    contactPhone: IndianMobile.transform(toE164).nullable().optional(),
    whatsappPhone: IndianMobile.transform(toE164).nullable().optional(),
    mapsUrl: GoogleMapsUrl.nullable().optional(),
    socialUrls: z.array(StorefrontSocialUrl).max(5).optional(),
    seoTitle: text(70).optional(),
    seoDescription: text(160).optional(),
    logoMediaId: Uuid.nullable().optional(),
    heroMediaId: Uuid.nullable().optional(),
    yardMediaIds: z
      .array(Uuid)
      .max(6)
      .refine((ids) => new Set(ids).size === ids.length, 'Choose each image once.')
      .optional(),
  })
  .strict();
export type StorefrontBrandingInput = z.infer<typeof StorefrontBrandingInput>;

export const CreateStorefrontInput = z
  .object({ subdomain: StorefrontSlug, theme: StorefrontTheme })
  .strict();
export type CreateStorefrontInput = z.infer<typeof CreateStorefrontInput>;
export const SetStorefrontEnabledInput = z.object({ enabled: z.boolean() }).strict();
export type SetStorefrontEnabledInput = z.infer<typeof SetStorefrontEnabledInput>;
export const SetPublicationInput = z
  .object({ marketplacePublished: z.boolean(), storefrontPublished: z.boolean() })
  .strict();
export type SetPublicationInput = z.infer<typeof SetPublicationInput>;
export const AddStorefrontDomainInput = z.object({ hostname: StorefrontHostname }).strict();
export type AddStorefrontDomainInput = z.infer<typeof AddStorefrontDomainInput>;
export const StorefrontInventoryQuery = DealerVehicleQuery;
export type StorefrontInventoryQuery = z.infer<typeof StorefrontInventoryQuery>;

export const StorefrontDnsRecord = z.object({
  type: z.enum(['TXT', 'CNAME', 'A']),
  name: z.string(),
  value: z.string(),
});
export const StorefrontDomainDto = z.object({
  id: Uuid,
  hostname: z.string(),
  kind: z.enum(['DEFAULT', 'CUSTOM']),
  status: StorefrontDomainStatus,
  isPrimary: z.boolean(),
  verifiedAt: z.string().nullable(),
  checkedAt: z.string().nullable(),
  certificateReady: z.boolean(),
  instructions: z.array(StorefrontDnsRecord),
  lastError: z.string().nullable(),
});
export type StorefrontDomainDto = z.infer<typeof StorefrontDomainDto>;

export const StorefrontConfigDto = z.object({
  id: Uuid,
  subdomain: z.string(),
  status: StorefrontStatus,
  theme: StorefrontTheme,
  displayName: z.string(),
  accentColor: z.string(),
  headline: z.string(),
  description: z.string(),
  about: z.string(),
  contactPhone: z.string().nullable(),
  whatsappPhone: z.string().nullable(),
  mapsUrl: z.string().nullable(),
  socialUrls: z.array(z.string()),
  seoTitle: z.string(),
  seoDescription: z.string(),
  logoMediaId: z.string().nullable(),
  heroMediaId: z.string().nullable(),
  yardMediaIds: z.array(z.string()),
  domains: z.array(StorefrontDomainDto),
  publicUrl: z.string().nullable(),
  updatedAt: z.string(),
});
export type StorefrontConfigDto = z.infer<typeof StorefrontConfigDto>;
export const StorefrontManagementResponse = z.object({
  enabled: z.boolean(),
  eligible: z.boolean(),
  infrastructureReady: z.boolean(),
  storefront: StorefrontConfigDto.nullable(),
});
export type StorefrontManagementResponse = z.infer<typeof StorefrontManagementResponse>;

export const PublicStorefrontDto = z.object({
  name: z.string(),
  legalName: z.string(),
  theme: StorefrontTheme,
  accentColor: z.string(),
  headline: z.string(),
  description: z.string(),
  about: z.string(),
  address: z.string(),
  city: z.string().nullable(),
  contactPhone: z.string().nullable(),
  whatsappPhone: z.string().nullable(),
  mapsUrl: z.string().nullable(),
  socialUrls: z.array(z.string()),
  logoUrl: z.string().nullable(),
  heroUrl: z.string().nullable(),
  yardUrls: z.array(z.string()),
  primaryHostname: z.string(),
  requestedHostname: z.string(),
  seoTitle: z.string(),
  seoDescription: z.string(),
  isVerified: z.boolean(),
  updatedAt: z.string(),
});
export type PublicStorefrontDto = z.infer<typeof PublicStorefrontDto>;
export const StorefrontInventoryResponse = z.object({
  data: z.array(VehicleCardDto),
  page: OffsetPage,
});
export type StorefrontInventoryResponse = z.infer<typeof StorefrontInventoryResponse>;
export const StorefrontVehicleResponse = PublicVehicleDetail;
export type StorefrontVehicleResponse = z.infer<typeof StorefrontVehicleResponse>;
