export const DOC_TAGS = {
  auth: 'Authentication',
  config: 'Platform configuration',
  dealersPublic: 'Dealers (public)',
  vehiclesPublic: 'Vehicles (public)',
  dealerAccount: 'Dealer account',
  vehicles: 'Vehicles (dealer)',
  enquiries: 'Enquiries',
  savedVehicles: 'Saved cars',
  admin: 'Admin',
  moderation: 'Moderation',
  media: 'Vehicle images',
  health: 'Health',
  storage: 'Storage (local only)',
  metrics: 'Metrics',
} as const;

export type DocTag = (typeof DOC_TAGS)[keyof typeof DOC_TAGS];

export const TAG_ORDER: DocTag[] = [
  DOC_TAGS.auth,
  DOC_TAGS.config,
  DOC_TAGS.dealersPublic,
  DOC_TAGS.vehiclesPublic,
  DOC_TAGS.dealerAccount,
  DOC_TAGS.vehicles,
  DOC_TAGS.enquiries,
  DOC_TAGS.savedVehicles,
  DOC_TAGS.admin,
  DOC_TAGS.moderation,
  DOC_TAGS.media,
  DOC_TAGS.health,
  DOC_TAGS.storage,
  DOC_TAGS.metrics,
];
