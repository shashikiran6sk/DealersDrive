export const MANUAL_ACTIVATION_NOTICE_TEXT = {
  fallbackTitle: 'Manual activation — documents not verified',
  activatedBy: (who: string, when: string) => `Activated manually by ${who} on ${when}.`,
  activatedWhen: (when: string) => `Activated manually on ${when}.`,
  unknownWhen: 'Activated manually.',
  justificationLabel: 'Justification',
  outstandingLabel: 'Still unverified',
  outstandingNone: 'Every document category has since been verified through the standard review.',
  neverVerifies:
    'A manual activation verified no document and does not grant the Dealer Verified badge. Review the outstanding documents below as usual.',
} as const;
