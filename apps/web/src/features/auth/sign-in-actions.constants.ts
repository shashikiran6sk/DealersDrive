export const SIGN_UP_COOKIE = 'dd_signup';

export const SIGN_UP_TTL_SECONDS = 600;

export const SIGN_IN_ACTION_TEXT = {
  notVerified: 'That code could not be verified.',
  noSession: 'You were verified, but we could not sign you in. Please try again.',
  nameRequired: 'Enter your name.',
  startAgain: 'That verification has expired. Enter your mobile number again to get a new code.',
  signUpFailed: 'Your account could not be created. Please try again.',
  apiUnavailable: 'The service is unavailable. Try again shortly.',
} as const;
