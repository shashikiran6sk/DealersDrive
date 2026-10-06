export const MY_ENQUIRIES_PATH = '/enquiries';

export const CUSTOMER_ENQUIRIES_TEXT = {
  title: 'My enquiries',
  intro: 'Each dealership has your name and verified mobile number, and will contact you.',
  listLabel: 'Your enquiries',
  sentOn: (date: string) => `Sent ${date}`,
  noMessage: 'No message — you asked to be contacted.',
  emptyTitle: 'No enquiries yet',
  emptyMessage: 'When you enquire about a car, you can follow it here.',
  browse: 'Browse cars',
  browseHref: '/cars',
  more: 'Show more',
  noLongerListed: '· No longer listed',
  getHelp: 'Get help with this enquiry',
  getHelpHref: (id: string) => `/support-requests/new?enquiry=${encodeURIComponent(id)}`,
} as const;

export function loginToSee(): string {
  return `/login?returnTo=${encodeURIComponent(MY_ENQUIRIES_PATH)}`;
}

export const CUSTOMER_ENQUIRIES_LOADING = {
  label: 'Loading your enquiries',
  rows: 3,
} as const;
