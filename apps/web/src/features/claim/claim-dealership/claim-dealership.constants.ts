import type { DealerClaimState } from '@dealers-drive/contracts';

export const CLAIM_TEXT = {
  eyebrow: 'Claim your dealership',
  heading: (dealerName: string) => `${dealerName} is ready for you`,
  location: (city: string | null, district: string | null) =>
    [city, district].filter(Boolean).join(' · '),
  assistedBy: (name: string) => `Set up with you by ${name} from Dealers-Drive.`,
  stepEmail: 'Step 1 of 2 · Confirm your email',
  emailBody: (masked: string) =>
    `We sent this link to ${masked}. Confirm that this is your address — it is where we will write to you about your dealership.`,
  confirmEmail: 'Confirm this is my email',
  confirming: 'Confirming…',
  stepPhone: 'Step 2 of 2 · Verify the dealership’s mobile',
  phoneBody: (masked: string) =>
    `We will send a code to the number registered for this dealership (${masked}). Enter that number below.`,
  phoneLabel: 'Dealership mobile number',
  phoneHint: (last4: string) => `the one ending in ${last4}`,
  phonePlaceholder: '98400 12345',
  phoneInvalid: 'Enter a 10-digit Indian mobile number.',
  phoneWrong: (last4: string) => `Enter the number ending in ${last4}.`,
  linkedTo: 'your dealership',
  verifiedTitle: 'Dealership claimed',
  continue: 'Open your dealership',
  opening: 'Opening your dealership…',
  ignore:
    'If you did not meet anyone from Dealers-Drive, you can ignore this page — nothing happens without the code sent to the dealership’s phone.',
  states: {
    CLAIMED: {
      title: 'This dealership already has an owner',
      body: 'Sign in with the dealership’s mobile number to manage it.',
      action: 'Sign in',
    },
    EXPIRED: {
      title: 'This link has expired',
      body: 'Ask your Dealers-Drive representative to send a new one. Links work for three days.',
      action: 'Back to Dealers-Drive',
    },
    SUPERSEDED: {
      title: 'A newer link has been sent',
      body: 'Use the most recent email from Dealers-Drive for this dealership.',
      action: 'Back to Dealers-Drive',
    },
  } satisfies Partial<Record<DealerClaimState, { title: string; body: string; action: string }>>,
  signInHref: '/login?as=dealer',
  homeHref: '/',
} as const;
