import type { WizardStep } from './vehicle-wizard.types';

export const WIZARD_STEPS: readonly WizardStep[] = [
  'registration',
  'basics',
  'details',
  'pricing',
  'review',
];

export const STEP_LABELS: Record<WizardStep, string> = {
  registration: 'Registration',
  basics: 'Vehicle basics',
  details: 'Vehicle details',
  pricing: 'Pricing',
  review: 'Review',
};

export const STEP_HEADINGS: Record<WizardStep, string> = {
  registration: 'Registration number',
  basics: 'What is it?',
  details: 'Its history and condition',
  pricing: 'Price and description',
  review: 'Review the details',
};

export const STEP_FIELDS: Record<Exclude<WizardStep, 'review'>, readonly string[]> = {
  registration: ['registrationNumber'],
  basics: [
    'make',
    'model',
    'variant',
    'manufacturingYear',
    'registrationYear',
    'fuelType',
    'transmission',
    'bodyType',
  ],
  details: ['kilometersDriven', 'ownerCount', 'color', 'insuranceType', 'insuranceValidUntil'],
  pricing: ['priceRupees', 'negotiability', 'description'],
};

export const NUMBER_FIELDS = new Set([
  'manufacturingYear',
  'registrationYear',
  'kilometersDriven',
  'ownerCount',
]);

export const FORM_FIELD_OF: Record<string, string> = { pricePaise: 'priceRupees' };

export const VEHICLE_WIZARD_TEXT = {
  pageTitle: 'Add vehicle',
  editTitle: 'Edit vehicle',
  intro:
    'Enter the details as they appear on the registration certificate. Dealers-Drive photographs the car itself once you submit it for review.',
  back: 'Back',
  saveDraft: 'Save draft',
  continue: 'Continue',
  cancel: 'Cancel',
  done: 'Back to dashboard',
  saveAndExit: 'Finish later',
  viewInventory: 'View inventory',
  draftSaved: 'Draft saved. You can come back to it at any time.',
  unavailable: 'We could not save that just now. Try again in a moment.',
  notSaved: 'That could not be saved.',
  numbersOnly: 'Enter digits only.',
  makeHint: 'as on the RC',
  makePlaceholder: 'Hyundai',
  modelPlaceholder: 'Creta',
  variantPlaceholder: 'SX(O)',
  variantHint: 'optional',
  registrationYearHint: 'optional',
  choose: 'Choose…',
  kmPlaceholder: '22,400',
  insuranceDateHint: 'not needed without insurance',
  pricePlaceholder: '14,50,000',
  priceHint: 'in rupees',
  descriptionHint: 'optional',
  descriptionPlaceholder:
    'Service history, recent work, anything a buyer should know. No phone numbers.',
  reviewComplete: 'Everything needed for review is filled in.',
  reviewIncomplete: 'A few details are still missing.',
  reviewNoPhotos:
    'You do not upload photographs. After you submit, Dealers-Drive arranges a shoot and adds the finished pictures itself.',
  fix: 'Fix',
  submit: 'Submit for review',
  resubmit: 'Resubmit for review',
  notSubmitted: 'That vehicle could not be submitted.',
  submitBlocked: 'Fill in the missing details to submit.',
  submitByManager: 'Your changes are saved as a draft. A manager or the owner sends it for review.',
  submitAfterApproval:
    'Saved as a draft. It can be submitted for review once the dealership is approved.',
  viewDealership: 'Back to the dealership',
  submittedTag: 'Pending review',
  submittedTitle: 'Submitted for review',
  submittedBody:
    'Our team will check the details and arrange a photo shoot at your yard. We will let you know if anything needs changing before the car goes live.',
  lockedTitle: 'This vehicle cannot be edited right now',
  lockedBody: {
    PENDING_REVIEW:
      'It is with our team for review. We will arrange the photographs and let you know if anything needs changing.',
    ACTIVE: 'It is live on the marketplace.',
    RESERVED: 'It is reserved for a buyer, and still shown on the marketplace.',
    REJECTED: 'It was not approved for the marketplace.',
    SOLD: 'It has been marked sold.',
    WITHDRAWN:
      'You have withdrawn it from the marketplace. Request reactivation when it is for sale again.',
  },
  changesRequestedTitle: 'Our team asked for changes',
  rejectedTitle: 'Not approved',
  edit: 'Edit',
  notEntered: 'Not entered',
} as const;

export const FIELD_LABELS: Record<string, string> = {
  registrationNumber: 'Registration number',
  make: 'Make',
  model: 'Model',
  variant: 'Variant',
  manufacturingYear: 'Manufacturing year',
  registrationYear: 'Registration year',
  fuelType: 'Fuel',
  transmission: 'Transmission',
  bodyType: 'Body type',
  kilometersDriven: 'Kilometres driven',
  ownerCount: 'Owners',
  color: 'Colour',
  insuranceType: 'Insurance',
  insuranceValidUntil: 'Insurance valid until',
  priceRupees: 'Price',
  negotiability: 'Price is',
  description: 'Description',
};

export const OWNER_OPTIONS = [1, 2, 3, 4, 5] as const;
