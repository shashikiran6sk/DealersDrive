export const VERIFICATION_PANEL_TEXT = {
  heading: 'Dealer’s email',
  none: 'No verification email has been sent yet.',
  queued: (email: string) => `A verification link is on its way to ${email}.`,
  sent: (email: string, when: string) => `Verification link sent to ${email} on ${when}.`,
  verified: (when: string) => `The dealer confirmed this address on ${when}.`,
  claimed: (when: string) => `The dealer claimed this dealership on ${when}.`,
  expired: 'The last link has expired. Send a new one when you next speak to the dealer.',
  explain:
    'The dealer confirms the email from the link, then verifies the dealership’s mobile to claim it. You never see the link.',
  resend: 'Send a new link',
  resending: 'Sending…',
  resent: 'A new link is on its way. The old one no longer works.',
} as const;
