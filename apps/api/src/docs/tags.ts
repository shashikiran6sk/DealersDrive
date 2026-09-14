export const DOC_TAGS = {
  auth: 'Authentication',
  config: 'Platform configuration',
  dealersPublic: 'Dealers (public)',
  dealerAccount: 'Dealer account',
  admin: 'Admin',
  media: 'Media',
  health: 'Health',
  storage: 'Storage (local only)',
  metrics: 'Metrics',
} as const;

export type DocTag = (typeof DOC_TAGS)[keyof typeof DOC_TAGS];

export const TAG_ORDER: DocTag[] = [
  DOC_TAGS.auth,
  DOC_TAGS.config,
  DOC_TAGS.dealersPublic,
  DOC_TAGS.dealerAccount,
  DOC_TAGS.admin,
  DOC_TAGS.media,
  DOC_TAGS.health,
  DOC_TAGS.storage,
  DOC_TAGS.metrics,
];
