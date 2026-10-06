export const CONFIG_EDITOR_TEXT = {
  save: 'Save',
  saved: 'Saved.',
  saveFailed: 'We could not save that setting.',
  notInUse: 'Not in use yet',
  enabled: 'Enabled',
  disabled: 'Disabled',
  oneEntryPerLine: 'One entry per line. ',
  readBy: (readBy: string) => `Read by ${readBy}.`,
  lastChanged: (date: string) => `Last changed ${date}`,
} as const;

export const BOOLEAN_VALUE = { true: 'true', false: 'false' } as const;

export const CONFIG_PAGE_TEXT = {
  membersMovedTitle: 'Team access has its own page',
  membersMovedBody:
    'Inviting people, changing roles and disabling access now live under Members, with each person’s history.',
  membersMovedLink: 'Open Members →',
} as const;
