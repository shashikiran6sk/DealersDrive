import {
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_DESCRIPTION_MAX,
  SUPPORT_MESSAGE_MAX,
  SUPPORT_SUBJECT_MAX,
  SupportTicketCategory,
} from '@dealers-drive/contracts';

export const SUPPORT_REQUESTS_PATH = '/support-requests';

export const NEW_SUPPORT_REQUEST_PATH = '/support-requests/new';

export const SUPPORT_CATEGORY_OPTIONS = SupportTicketCategory.options.map((value) => ({
  value,
  label: SUPPORT_CATEGORY_LABELS[value],
}));

export const SUPPORT_LIMITS = {
  subject: SUPPORT_SUBJECT_MAX,
  description: SUPPORT_DESCRIPTION_MAX,
  message: SUPPORT_MESSAGE_MAX,
} as const;

export const SUPPORT_REQUESTS_TEXT = {
  title: 'Support requests',
  intro:
    'Ask Dealers-Drive for help with a dealer, a car, an enquiry or your account. Every request and our replies stay here.',
  create: 'Create support request',
  listLabel: 'Your support requests',
  updated: (label: string) => `Updated ${label}`,
  emptyTitle: 'You haven’t created any support requests yet',
  emptyMessage:
    'If something is not right with a dealer, a car, an enquiry or your account, tell us and we will help.',
  more: 'Show more',
  otherWays: 'Prefer email or WhatsApp?',
  contactLink: 'Other ways to reach us',
  contactHref: '/contact',
} as const;

export const SUPPORT_FORM_TEXT = {
  title: 'Create a support request',
  intro:
    'Tell us what happened. We reply here, and you can follow the request from Support requests.',
  back: '← Support requests',
  category: 'What is it about?',
  categoryPlaceholder: 'Choose a topic',
  enquiry: 'Which enquiry?',
  enquiryHint: '(optional)',
  noEnquiry: 'Not about a particular enquiry',
  enquiryOption: (title: string, dealer: string, sent: string) => `${title} · ${dealer} · ${sent}`,
  noEnquiries: 'You have not sent any enquiries yet.',
  subject: 'Subject',
  subjectPlaceholder: 'A short summary, e.g. “The dealer has not called me back”',
  description: 'Describe the issue',
  descriptionPlaceholder:
    'What happened, when, and what you would like us to do. Include anything that will help us look into it.',
  count: (used: number, max: number) =>
    `${used.toLocaleString('en-IN')} / ${max.toLocaleString('en-IN')}`,
  submit: 'Send request',
  sending: 'Sending…',
  cancel: 'Cancel',
  privacy: 'Dealers-Drive support will see your name and verified mobile number with this request.',
} as const;

export const SUPPORT_DETAIL_TEXT = {
  back: '← Support requests',
  metaTitle: 'Support request',
  category: 'Topic',
  created: 'Created',
  updated: 'Last updated',
  enquiry: 'About your enquiry',
  enquirySent: (label: string) => `Sent ${label}`,
  viewCar: 'View car',
  conversation: 'Conversation',
  you: 'You',
  original: 'Original request',
  replyLabel: 'Reply to Dealers-Drive support',
  replyPlaceholder: 'Write your reply',
  send: 'Send reply',
  sending: 'Sending…',
  resolvedNote: 'This request is resolved. Replying will reopen it.',
  waitingNote: 'We are waiting for your reply.',
  closedTitle: 'This request is closed',
  closedMessage:
    'Closed requests cannot take new replies. If you still need help, create a new request and mention this reference.',
  newRequest: 'Create a new request',
  signedOut: 'Your session has ended. Sign in again to reply.',
  timesInIst: 'Times are IST.',
} as const;

export function supportLoginHref(returnTo: string): string {
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export const SUPPORT_LOADING_LABEL = 'Loading';
