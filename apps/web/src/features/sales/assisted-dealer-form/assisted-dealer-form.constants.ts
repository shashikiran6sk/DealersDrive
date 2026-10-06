export interface AssistedField {
  name: string;
  label: string;
  hint?: string;
  type?: 'text' | 'email' | 'tel' | 'url';
  inputMode?: 'text' | 'email' | 'tel' | 'numeric' | 'url';
  autoComplete?: string;
  required: boolean;
  wide?: boolean;
}

export const CONTACT_FIELDS: readonly AssistedField[] = [
  { name: 'contactName', label: 'Contact person', required: true, autoComplete: 'off' },
  {
    name: 'email',
    label: 'Dealer’s email',
    hint: 'stays unverified until the dealer confirms it',
    type: 'email',
    inputMode: 'email',
    required: true,
    autoComplete: 'off',
  },
  { name: 'landline', label: 'Landline', hint: 'optional', type: 'tel', required: false },
];

export const BUSINESS_FIELDS: readonly AssistedField[] = [
  {
    name: 'legalName',
    label: 'Dealership name',
    hint: 'as registered — buyers see this',
    required: true,
    wide: true,
  },
  { name: 'addressLine', label: 'Showroom address', required: true, wide: true },
  { name: 'city', label: 'City / town', required: true },
  { name: 'district', label: 'District', required: true },
  { name: 'state', label: 'State', required: true },
  { name: 'pincode', label: 'Pincode', inputMode: 'numeric', required: true },
  {
    name: 'mapsUrl',
    label: 'Google Maps link',
    hint: 'Share → Copy link, from the yard',
    type: 'url',
    inputMode: 'url',
    required: true,
    wide: true,
  },
  {
    name: 'tagline',
    label: 'One line about the dealership',
    hint: 'buyers read this',
    required: true,
    wide: true,
  },
  { name: 'gstin', label: 'GSTIN', required: false },
  { name: 'pan', label: 'PAN', required: false },
];

export const ASSISTED_FORM_TEXT = {
  contactLegend: 'Contact',
  businessLegend: 'Dealership',
  servicesLabel: 'What the yard does',
  servicesHint: 'add one at a time',
  create: 'Create dealership',
  save: 'Save details',
  saved: 'Saved.',
} as const;

export const TEXT_FIELD_NAMES = [...CONTACT_FIELDS, ...BUSINESS_FIELDS].map((field) => field.name);

export const REQUIRED_FIELD_NAMES = new Set(
  [...CONTACT_FIELDS, ...BUSINESS_FIELDS]
    .filter((field) => field.required)
    .map((field) => field.name),
);
