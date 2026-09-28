export const ENQUIRE_PARAM = 'enquire';

export const ENQUIRY_MESSAGE_MAX = 1000;

export const ENQUIRY_PANEL_TEXT = {
  enquire: 'Enquire now',
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
  alreadySentTitle: 'You have already enquired about this car',
  unavailableTitle: 'This car is no longer available',
  loading: 'Checking your account…',
} as const;

export function loginHref(pathname: string): string {
  const back = `${pathname}?${ENQUIRE_PARAM}=1`;
  return `/login?returnTo=${encodeURIComponent(back)}`;
}
