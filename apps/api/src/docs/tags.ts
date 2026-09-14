/**
 * The reference's tags — the section headings a reader sees in Swagger UI.
 *
 * One definition rather than a string on each of the sixty-six operations: a tag
 * is the *same* heading everywhere it appears, and a typo in one operation files
 * that endpoint under a section of its own. `buildOpenApiDocument` already
 * throws when `TAG_ORDER` names a tag no module declares, so the two lists below
 * cannot drift apart either.
 */
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

/** The order the sections appear in. A reader meets the product in this order. */
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
