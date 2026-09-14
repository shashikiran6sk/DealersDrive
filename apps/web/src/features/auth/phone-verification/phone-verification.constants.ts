export const RESEND_SECONDS = 30;

export const LOCAL_ATTEMPTS = 3;

export const OTP_DIGITS = 6;

export const PHONE_TEXT = {
  wrongCode: 'That code is not right. Check the SMS, or ask for a new one.',
  sendFailed: 'We could not send a code to that number. Check it and try again.',

  unavailableTitle: 'Mobile verification is unavailable',
  unavailableReason: 'We could not reach the verification service.',
  unavailableTail:
    'Your dealership cannot be set up until this number is confirmed — please try again in a few minutes.',

  verifiedTitle: 'Mobile number verified',
  verifiedTag: 'Verified',
  yourAccount: 'your account',
  nextStep: 'Next: your dealership’s details',
  continueToBusiness: 'Continue to business details',

  sendOtp: 'Send OTP',
  codeTitle: 'Verify your mobile number',
  failedTitle: 'That code did not match',
  changeNumber: 'Change number',
  otpLabel: '6-digit verification code',
  resend: 'Resend code',
  verifyAndContinue: 'Verify & continue',
  cancel: 'Cancel',
  askForNewCode: 'Ask for a new code to try again.',
  resendIn: (formatted: string) => `You can ask for a new code in ${formatted}`,
} as const;
