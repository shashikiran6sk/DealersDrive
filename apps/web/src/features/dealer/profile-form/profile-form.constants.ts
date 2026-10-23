import type { ProfileFormState } from '@/features/dealer/profile-actions';

export const EMPTY_FORM_STATE: ProfileFormState = { status: 'idle', fieldErrors: {} };

export const EMPTY_VALUE = '—';

export const MIN_YEAR = 1900;

export const PROFILE_FORM_TEXT = {
  ownerOnly:
    'Only the owner can change the dealership’s profile, documents and team. You can see it here.',
  savedPending:
    'Saved. Your proposed profile and customer contact changes are waiting for admin approval. Customers keep seeing the approved details until then.',
  saved: 'Your profile has been saved.',
  invalidYear: 'Enter a valid year.',

  dealershipHeading: 'Dealership',
  contactHeading: 'Contact',
  customerContactLabel: 'Customer contact number — mobile or landline',
  customerContactHint:
    'Optional. Saving confirms this number may be shared with signed-in customers after admin approval. Include the STD code for a landline. Leave blank to request removal.',
  newContact: 'Proposed customer contact number',
  removeContact: 'Remove the call option after approval',
  addressHeading: 'Address',
  taxHeading: 'Tax identifiers',

  nameLabel: 'Dealership name',
  establishedLabel: 'Established',
  taglineLabel: 'One line about your dealership',
  taglineHintWaiting: 'waiting for review — cancel above to change it',
  taglineHint: 'optional — shown under your name on your public page — checked before it appears',
  taglinePlaceholder:
    'Quality pre-owned cars since 1998 — professionally inspected, with expert support.',
  servicesLabel: 'Services you offer',
  servicesHintWaiting: 'waiting for review — cancel above to change them',
  servicesHint: 'one at a time, up to 12 — checked before they appear',
  servicesPlaceholder: 'In-house workshop',

  contactNote:
    'Your account mobile and email identify you. Contact support to change them. The customer contact number below is separate and changes require admin approval.',
  addressNote:
    'Your business address and contact identity need review when they change. Contact support to update them. Yard ownership and photographs do not determine Dealer Verified status.',
  taxNote:
    'Verified during onboarding. Contact support to change either — a silent edit would invalidate the verification your buyers rely on.',

  save: 'Save changes',
  saveNote:
    'Profile and customer contact changes require review; the established year updates immediately.',

  rejectedTitle: 'Your last change was not published',
  rejectedNote:
    'Your public page is unchanged. Edit the boxes below and save again — there is nothing else you need to do.',
  waitingTitle: 'Waiting for a quick check',
  waitingIntro: (submittedAtLabel: string) =>
    `You requested profile or customer contact changes on ${submittedAtLabel}. Customers see the current approved details until review is complete.`,
  newLine: 'Your new line',
  newServices: 'Your new services',
  cancelChange: 'Cancel this change',
  cancelNote: 'Your approved details stay in use and the boxes below unlock.',

  mapPlace:
    'This link names your dealership, so your public page shows your Google listing on the map — your name, your address and your rating.',
  mapPoint:
    'This link marks the right spot but does not name your dealership, so buyers see a plain pin rather than your Google listing. Contact support if you would like it changed to your business card.',
  mapNone:
    'We could not read a location out of this link, so your public page shows no map. “Get directions” still works. Contact support and we will re-point it.',
} as const;
