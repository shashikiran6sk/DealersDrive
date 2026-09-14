function upper(value: string): string {
  return value.toUpperCase();
}

/**
 * The fields, and where each one lives in `UpdateDealerInput`.
 *
 * One table rather than one JSX block per input: the form, the initial values,
 * the diff and the error mapping all walk it, and a field added to a form but
 * forgotten in the diff is the kind of bug that looks like "the console did not
 * save my change" and gets reported as flakiness.
 *
 * `path` is the dotted path the API answers errors against, minus the `body.`
 * prefix — so `address.city` matches `body.address.city`.
 */
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
  /*
   * The two fields written for a reader rather than for a form (**R32**), so
   * they are the two laid out differently. They replace `About`, the last box on
   * the platform reading a paragraph the product stopped collecting. A reviewer
   * can edit them for exactly the reason `About` was editable: they are free text
   * a dealership typed and a buyer will read, which makes them where a phone
   * number gets smuggled onto a public page — what rule 7 exists to catch.
   */
  { key: 'tagline', label: 'Tagline', path: 'tagline', mono: false, wide: true },
  {
    key: 'specialities',
    label: 'Services',
    path: 'specialities',
    mono: false,
    wide: true,
    /*
     * A list in the schema, one comma-separated box on the screen — the same
     * shape the dealer's own profile form uses. `list: true` is what tells the
     * patch to split it back apart; without it the API would be sent a string
     * where `UpdateDealerInput` wants an array, and `.strict()` would answer 400.
     */
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
