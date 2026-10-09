import { z } from 'zod';

export const ServiceLocationId = z.string().regex(/^[A-Za-z0-9-]{2,100}$/);
export const ServiceLocationParam = z.object({ id: ServiceLocationId });
export const ServiceLocationSettings = z
  .object({
    expectedVersion: z.number().int().positive(),
    active: z.boolean(),
    onboardingEnabled: z.boolean(),
    photographyAvailable: z.boolean().optional(),
  })
  .strict();
export type ServiceLocationSettings = z.infer<typeof ServiceLocationSettings>;

export const GovernmentSourceUrl = z
  .url()
  .max(500)
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (url.hostname.endsWith('.gov.in') || url.hostname.endsWith('.nic.in'))
    );
  }, 'Use the authoritative HTTPS government district source.');
export const AddServiceDistrictInput = z
  .object({
    stateId: ServiceLocationId,
    name: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .regex(/^[\p{L}\p{M} .'-]+$/u),
    sourceUrl: GovernmentSourceUrl,
    sourceReviewed: z.literal(true),
  })
  .strict();
export type AddServiceDistrictInput = z.infer<typeof AddServiceDistrictInput>;
export const ServiceDistrictDto = z.object({
  id: ServiceLocationId,
  stateId: ServiceLocationId,
  name: z.string(),
  sourceUrl: z.string(),
  active: z.boolean(),
  onboardingEnabled: z.boolean(),
  photographyAvailable: z.boolean(),
  version: z.number().int(),
});
export const ServiceStateDto = z.object({
  id: ServiceLocationId,
  name: z.string(),
  kind: z.enum(['STATE', 'UT']),
  active: z.boolean(),
  onboardingEnabled: z.boolean(),
  version: z.number().int(),
  districts: z.array(ServiceDistrictDto),
});
export const ServiceLocationsResponse = z.object({ data: z.array(ServiceStateDto) });
export type ServiceLocationsResponse = z.infer<typeof ServiceLocationsResponse>;
export type ServiceStateDto = z.infer<typeof ServiceStateDto>;
export type ServiceDistrictDto = z.infer<typeof ServiceDistrictDto>;
export const ServiceLocationHistory = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      action: z.string(),
      entityId: z.string(),
      at: z.string(),
      before: z.unknown(),
      after: z.unknown(),
    }),
  ),
});
export type ServiceLocationHistory = z.infer<typeof ServiceLocationHistory>;

const LEGACY_DISTRICT_FILTERS: Readonly<Record<string, string>> = {
  kanchipuram: 'kancheepuram',
  kanniyakumari: 'kanyakumari',
  pudukkottai: 'pudukottai',
  sivagangai: 'sivaganga',
  tiruvallur: 'thiruvallur',
  tiruvarur: 'thiruvarur',
  trichy: 'tiruchirappalli',
  tiruchi: 'tiruchirappalli',
  tirupattur: 'tirupathur',
  nilgiris: 'the-nilgiris',
  villupuram: 'viluppuram',
  tuticorin: 'thoothukudi',
};
export function canonicalDistrictFilterSlug(value: string): string {
  return LEGACY_DISTRICT_FILTERS[value] ?? value;
}
