export const DEFAULT_MAX_SERVICES = 12;
export const DEFAULT_MAX_SERVICE_LENGTH = 60;

export const SERVICE_INPUT_TEXT = {
  addLabel: 'Add',
  chipsLabel: 'Services added',
  removeLabel: (service: string) => `Remove ${service}`,
  removeGlyph: '×',
  atLimitPlaceholder: (max: number) => `${String(max)} services is the limit`,
  tooLong: (maxLength: number) => `Keep each service to ${String(maxLength)} characters or fewer.`,
  atLimit: (max: number) => `That is the ${String(max)}-service limit — remove one to add another.`,
  allDuplicates: 'You have already added that one.',
  someDuplicates: 'Some of those were already on the list.',
} as const;
