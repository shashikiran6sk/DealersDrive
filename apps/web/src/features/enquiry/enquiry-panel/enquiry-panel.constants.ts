export const ENQUIRE_PARAM = 'enquire';

export const ENQUIRY_MESSAGE_MAX = 1000;

export const ENQUIRY_PANEL_TEXT = {
  enquire: 'Enquire now',
  requiresLogin: 'Both options require login with your mobile number',
  callbackRequiresLogin: 'Requires login with your mobile number',
  call: 'Call dealer',
  callIntro: 'Speak directly with the dealership.',
  callConsent: 'The dealer will see your name and mobile number.',
  callback: 'Request a callback',
  callbackIntro: 'Send an enquiry and ask the dealer to call your verified mobile.',
  choose: 'How would you like to contact the dealer?',
  back: 'Back to contact options',
  copy: 'Copy number',
  copied: 'Number copied',
  copyFailed: 'Could not copy. Select the number to copy it.',
  callingNote:
    'Calling opens your phone app. A callback enquiry is sent only when you request one.',
  heading: 'Interested in this vehicle?',
  nameLabel: 'Name',
  mobileLabel: 'Mobile',
  verified: 'Verified',
  messageLabel: 'Message',
  messageHint: '(optional)',
  messagePlaceholder: 'Ask about the car, or when you can visit.',
  send: 'Send enquiry',
  sending: 'Sending…',
  cancel: 'Cancel',
  shareNote: (dealer: string) =>
    `${dealer} will receive your name and verified mobile number, and will contact you.`,
  sentTitle: 'Enquiry sent',
  sentBody: (dealer: string) => `${dealer} has received your contact request.`,
  alreadySentTitle: 'You already have an enquiry about this car',
  track: 'Track it in My enquiries',
  unavailableTitle: 'This car is no longer available',
  loading: 'Checking your account…',
  openFailedTitle: 'We couldn’t open the enquiry form',
  openFailed: 'This service is temporarily unavailable. Please try again.',
  sendFailed: 'We couldn’t send your enquiry right now. Please try again.',
} as const;

export const MY_ENQUIRIES_HREF = '/enquiries';

export function loginHref(pathname: string, action: 'call' | 'callback' = 'callback'): string {
  const back = `${pathname}?${ENQUIRE_PARAM}=${action === 'call' ? 'call' : '1'}`;
  return `/login?returnTo=${encodeURIComponent(back)}`;
}
