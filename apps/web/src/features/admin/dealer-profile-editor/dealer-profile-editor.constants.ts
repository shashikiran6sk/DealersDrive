function upper(value: string): string {
  return value.toUpperCase();
}

export const FIELDS = [
  { key: 'legalName', label: 'Dealership name', path: 'legalName', mono: false },
  { key: 'gstin', label: 'GSTIN', path: 'gstin', mono: true, transform: upper },
  { key: 'pan', label: 'PAN', path: 'pan', mono: true, transform: upper },
  { key: 'addressLine', label: 'Address', path: 'address.line', mono: false },
  { key: 'city', label: 'City', path: 'address.city', mono: false },
  { key: 'district', label: 'District', path: 'address.district', mono: false },
  { key: 'state', label: 'State', path: 'address.state', mono: false },
  { key: 'pincode', label: 'Pincode', path: 'address.pincode', mono: true },
  { key: 'mapsUrl', label: 'Google Maps location', path: 'address.mapsUrl', mono: false },
  { key: 'contactName', label: 'Contact', path: 'contact.fullName', mono: false },
  { key: 'contactPhone', label: 'Phone', path: 'contact.phone', mono: true },
  { key: 'contactEmail', label: 'Email', path: 'contact.email', mono: false },
  { key: 'landline', label: 'Landline', path: 'contact.landline', mono: true },
  { key: 'tagline', label: 'Tagline', path: 'tagline', mono: false, wide: true },
  {
    key: 'specialities',
    label: 'Services',
    path: 'specialities',
    mono: false,
    wide: true,
    list: true,
  },
] as const;

export const EMPTY_VALUE = '—';

export const DEALER_EDITOR_TEXT = {
  heading: 'Business',
  edit: 'Edit',
  cancel: 'Cancel',
  save: 'Save changes',
  saved: 'Saved. The dealer sees these details from now on.',
  saveFailed: 'Those changes did not save.',
  listHint: 'comma separated, up to 12',
  partialNote:
    'Only the fields you change are sent. Leaving one blank clears it where the dealer is allowed to have it blank, and is refused where they are not.',
} as const;
