import type { LoginAudience } from './login.types';

export const LOGIN_AUDIENCES: readonly LoginAudience[] = ['customer', 'dealer'];

export const LOGIN_TEXT = {
  title: 'Login',
  tabsLabel: 'Sign in as',
  tabs: { customer: 'Customer', dealer: 'Dealer' } satisfies Record<LoginAudience, string>,

  customerHeading: 'Customer login',
  customerIntro: 'Sign in with your mobile number to contact dealers. No password, no email.',

  nameVerified: 'Your number is verified',
  nameIntro: (phoneDisplay: string) =>
    `${phoneDisplay} is confirmed. Tell us what to call you, and dealers will see this name on your enquiries.`,
  nameLabel: 'Name',
  namePlaceholder: 'Your name',
  createAccount: 'Create account',
  creating: 'Creating your account…',
  startAgain: 'Enter your number again',

  dealerHeading: 'Dealer login',
  dealerIntro:
    'Use the Google account or the mobile number of your dealership. A new dealership starts here too.',
  or: 'or',
  usePhoneInstead: 'Use mobile number instead',
  trouble: 'Trouble signing in? Contact support',
  troubleHref: '/contact',
  googleUnavailable: 'Google sign-in is not configured',
} as const;

export const DEALER_LOGIN_ERRORS: Readonly<Record<string, string>> = {
  sign_in_failed: 'That sign-in could not be verified. Please try again.',
  identity_unverified:
    'Google could not confirm that account. Check that your Google email is verified, then try again.',
  google_declined: 'Sign-in was cancelled at Google. Nothing has changed.',
  invalid_callback: 'That sign-in link was incomplete. Please start again.',
  account_link_required:
    'A Dealers-Drive account already uses that email address. Contact support to link Google sign-in to it.',
  account_suspended: 'This account has been suspended. Contact support to restore access.',
  session_expired: 'Your session has ended. Sign in again to continue.',
};

export const DEALER_LOGIN_FALLBACK_ERROR = 'That sign-in could not be completed. Please try again.';
