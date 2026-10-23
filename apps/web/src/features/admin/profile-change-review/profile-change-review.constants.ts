export const MIN_REFUSAL_REASON = 6;

export const EMPTY_VALUE = '—';

export const PROFILE_CHANGE_TEXT = {
  heading: 'Proposed change to their public page',
  intro:
    'Customers still see the approved details. Check marketing text for contact details or links. For a customer contact number change, confirm that it belongs to the dealership and is suitable for customer calls.',
  taglineLabel: 'Tagline',
  servicesLabel: 'Services',
  contactLabel: 'Customer contact number',
  removeContact: 'Remove customer calling',
  liveNow: 'Live now',
  proposed: 'Proposed',
  unchanged: 'unchanged',
  reasonLabel: 'What should they change?',
  reasonHint: 'the dealer reads this word for word',
  reasonPlaceholder:
    'The tagline ends with a mobile number — buyers reach you through the contact button, which logs the lead for you.',
  refuse: 'Refuse this change',
  refuseOpen: 'Refuse…',
  cancel: 'Cancel',
  publish: 'Publish it',
  decisionFailed: 'That decision did not go through.',
  waiting: (label: string) => `waiting ${label}`,
} as const;
