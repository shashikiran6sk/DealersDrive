export const ENQUIRE_PARAM = 'enquire';

export const ENQUIRY_MESSAGE_MAX = 1000;

export const ENQUIRY_PANEL_TEXT = {
  enquire: 'Enquire now',
  requiresLogin: 'Requires login with your mobile number',
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

export function loginHref(pathname: string): string {
  const back = `${pathname}?${ENQUIRE_PARAM}=1`;
  return `/login?returnTo=${encodeURIComponent(back)}`;
}
