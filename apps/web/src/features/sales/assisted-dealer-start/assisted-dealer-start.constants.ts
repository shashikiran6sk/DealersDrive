export const START_TEXT = {
  stepVerify: 'Step 1 of 3 · Verify the dealer’s mobile and email',
  stepDetails: 'Step 2 of 3 · Business details',
  verifyIntro:
    'Both are proved with a code the dealer receives. They become the dealer’s own sign-in: with this mobile number, or with Google on this email.',
  phoneLabel: 'Dealer’s mobile number',
  phoneHint: 'the dealer will receive the code',
  phonePlaceholder: '98400 12345',
  consentMissing:
    'Read the consent sentence to the dealer and tick the box before sending the code.',
  phoneInvalid: 'Enter a 10-digit Indian mobile number.',
  verifiedTitle: 'Dealer’s mobile verified',
  linkedTo: 'this new dealership',
  bothNeeded: 'Verify both the mobile number and the email to continue.',
  continue: 'Continue to business details',
  verifiedSummary: (phone: string, email: string) => `Verified: ${phone} · ${email}`,
  ticketNote: 'Finish this step within 30 minutes, or verify the mobile and email again.',
  reverifyHint:
    'If the verification expires, verify the mobile and email again. Your entered details will be kept.',
  reverify: 'Verify again',
} as const;
