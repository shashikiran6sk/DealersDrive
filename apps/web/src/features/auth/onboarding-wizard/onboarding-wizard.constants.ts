export const ONBOARDING_STEPS = ['Account', 'Business', 'Documents', 'Review'] as const;

/**
 * The fields that live on step 1.
 *
 * One list, used for both halves of the same rule: what the browser validates
 * before it will move off the Account step, and what the wizard walks *back* to
 * that step for when the API refuses one of them. Two lists would drift, and the
 * drift would be a dealer stuck on step 2 with an invisible error.
 */
export const ACCOUNT_FIELDS = new Set(['fullName', 'phone']);

export const ONBOARDING_PATH = {
  account: '/dealer/onboarding?step=1',
  review: '/dealer/onboarding?step=3',
  documents: '/dealer/onboarding?step=2',
  dashboard: '/dealer',
} as const;

/** A required box with no minimum is satisfied by `-`. */
export const TAGLINE_MIN = 10;
export const TAGLINE_MAX = 200;

/**
 * What C3 says is still missing, in words a dealer can act on. The API answers
 * with field keys — `gstin`, `GST_CERTIFICATE` — which are precise and not
 * something to put in front of somebody at the end of a sign-up form.
 */
export const MISSING_LABELS: Record<string, string> = {
  gstin: 'GSTIN',
  pan: 'PAN',
  GST_CERTIFICATE: 'GST certificate',
  PAN_CARD: 'PAN card',
  ADDRESS_PROOF: 'Address proof',
  YARD_PHOTO: 'Photo of your yard',
  legalName: 'Dealership name',
  addressLine: 'Address',
  pincode: 'Pincode',
  city: 'City',
  district: 'District',
  state: 'State',
  mapsUrl: 'Google Maps location',
  tagline: 'One line about your dealership',
  specialities: 'Services you offer',
  fullName: 'Your name',
  phone: 'Phone number',
  email: 'Email address',
};

export const ONBOARDING_TEXT = {
  missingName: 'Tell us your name.',
  missingPhone: 'Enter a 10-digit Indian mobile number.',

  sentBackTitle: 'We need one thing changed before we can verify you',
  sentBackNote: 'Everything you entered is still here. Fix what is named above and submit again.',

  back: 'Back',
  continue: 'Continue',
  saving: 'Saving…',
  creating: 'Creating your dealership…',

  accountLegend: 'Your account',
  accountHeading: 'Create your account',
  accountIntro: 'This is the person who will manage the dealership on Dealers-Drive.',
  googleAccount: 'Google account',
  verifiedWithGoogle: 'Verified with Google',
  fullNameLabel: 'Full name',
  phoneLabel: 'Phone',
  phoneHint: '+91',
  phonePlaceholder: '98400 12345',

  businessLegend: 'Your dealership',
  businessHeading: 'Dealership information',
  businessIntro: 'This is what buyers see on every one of your listings.',
  taglinePlaceholder:
    'Quality pre-owned cars since 1998 — professionally inspected, with expert support.',

  documentsHeading: 'Business verification',
  documentsIntro:
    'Your registrations, three documents and a photo of your yard, reviewed by our team. Listings can be prepared while this is pending — they go live once you are verified.',
  saved: 'Saved.',
  saveRegistrations: 'Save registrations',
  stillNeeded: 'Still needed before you can submit',

  underReview: 'Under review',
  readyToSubmit: 'Ready to submit',
  reviewingHeading: 'We are reviewing your dealership',
  submitHeading: 'Submit for verification',
  submitIntro:
    'Once you submit, our team checks your business details and documents. You can keep adding vehicles in the meantime.',
  prepareNote:
    'You can add vehicles and prepare listings now. Publishing needs a verified dealership and one listing credit.',
  goToDashboard: 'Go to dashboard',
  submitting: 'Submitting…',
  submit: 'Submit for verification',
  reviewingIntro: (brandName: string) =>
    `Our team is checking ${brandName} and the documents you uploaded. Verification usually takes one working day.`,
} as const;
