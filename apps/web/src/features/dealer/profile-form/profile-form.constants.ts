import type { ProfileFormState } from '@/features/dealer/profile-actions';

export const EMPTY_FORM_STATE: ProfileFormState = { status: 'idle', fieldErrors: {} };

export const EMPTY_VALUE = '—';

export const MIN_YEAR = 1900;

export const PROFILE_FORM_TEXT = {
  savedPending:
    'Saved. Your line and services go to us for a quick check before they appear on your public page — everything else is already live.',
  saved: 'Your profile has been saved.',
  invalidYear: 'Enter a valid year.',

  dealershipHeading: 'Dealership',
  contactHeading: 'Contact',
  addressHeading: 'Address',
  taxHeading: 'Tax identifiers',

  nameLabel: 'Dealership name',
  establishedLabel: 'Established',
  taglineLabel: 'One line about your dealership',
  taglineHintWaiting: 'waiting for review — cancel above to change it',
  taglineHint: 'shown under your name on your public page — checked before it appears',
  taglinePlaceholder:
    'Quality pre-owned cars since 1998 — professionally inspected, with expert support.',
  servicesLabel: 'Services you offer',
  servicesHintWaiting: 'waiting for review — cancel above to change them',
  servicesHint: 'one at a time, up to 12 — checked before they appear',
  servicesPlaceholder: 'In-house workshop',

  contactNote:
    'These are how buyers and we reach a business that has been verified. Contact support to change any of them.',
  addressNote:
    'Your address and map pin are what your verification was about — the yard photograph, the address proof and the check we ran on them. They cannot be edited here. A dealership that has actually moved closes this account and opens a new one, so the new premises are verified the way these were. Contact support to start that.',
  taxNote:
    'Verified during onboarding. Contact support to change either — a silent edit would invalidate the verification your buyers rely on.',

  save: 'Save changes',
  saveNote: 'Changes appear on your public dealership page immediately.',

  rejectedTitle: 'Your last change was not published',
  rejectedNote:
    'Your public page is unchanged. Edit the boxes below and save again — there is nothing else you need to do.',
  waitingTitle: 'Waiting for a quick check',
  waitingIntro: (submittedAtLabel: string) =>
    `You changed how your dealership describes itself on ${submittedAtLabel}. We read these before they go on your public page — buyers see the current version until then.`,
  newLine: 'Your new line',
  newServices: 'Your new services',
  cancelChange: 'Cancel this change',
  cancelNote: 'Your previous wording comes back and the boxes below unlock.',

  mapPlace:
    'This link names your dealership, so your public page shows your Google listing on the map — your name, your address and your rating.',
  mapPoint:
    'This link marks the right spot but does not name your dealership, so buyers see a plain pin rather than your Google listing. Contact support if you would like it changed to your business card.',
  mapNone:
    'We could not read a location out of this link, so your public page shows no map. “Get directions” still works. Contact support and we will re-point it.',
} as const;
