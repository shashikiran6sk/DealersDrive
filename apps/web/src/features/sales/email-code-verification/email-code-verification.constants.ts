export const EMAIL_RESEND_SECONDS = 60;

export const EMAIL_CODE_TEXT = {
  emailLabel: 'Dealer’s email',
  emailHint: 'the dealer will receive a 6-digit code',
  emailPlaceholder: 'dealer@example.com',
  emailInvalid: 'Enter a valid email address.',
  send: 'Send code',
  codeTitle: 'Enter the code from the email',
  sentTo: (email: string) => `We sent a 6-digit code to ${email}. It is valid for 10 minutes.`,
  failedTitle: 'That code did not match',
  wrongCode: 'That code is not right. Check the email and try again.',
  codeLabel: '6-digit code from the email',
  verify: 'Verify email',
  changeEmail: 'Change email',
  resend: 'Send a new code',
  resendIn: (formatted: string) => `You can send a new code in ${formatted}`,
  resent: 'A new code is on its way. Use the code from the latest email.',
  verifiedTitle: 'Dealer’s email verified',
  verifiedBody: (email: string) => `${email} has been verified with the code the dealer received.`,
  verifiedTag: 'Verified',
} as const;
