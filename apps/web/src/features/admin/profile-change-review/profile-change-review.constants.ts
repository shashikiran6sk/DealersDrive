export const MIN_REFUSAL_REASON = 6;

export const EMPTY_VALUE = '—';

export const PROFILE_CHANGE_TEXT = {
  heading: 'Proposed change to their public page',
  intro:
    'The dealer edited how their dealership describes itself. Buyers are still seeing the current version. Check it for phone numbers, links and anything the platform would not want to be repeating on their behalf.',
  taglineLabel: 'Tagline',
  servicesLabel: 'Services',
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
