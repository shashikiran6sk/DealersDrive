/**
 * The RTO code for an Indian state or union territory — `Tamil Nadu` → `TN`.
 *
 * ## What this is, and what it is not
 *
 * It is **not** location data. It adds no place, holds no count and decides
 * nothing: the states the location dialog shows are whatever the dealerships on
 * the platform typed, and this only says how to abbreviate one on a plate. The
 * precedent is `apps/api/src/platform/rc/rc-aliases.ts` — a committed constant
 * mapping VAHAN's maker strings to brands, which **D1** kept precisely because
 * a fixed public constant is not a catalogue.
 *
 * The codes are the first two characters of every registration plate issued in
 * that state, which is why the dialog can wear them as plates without inventing
 * a motif: `TN 09 BX 4412` starts with the same two letters this returns.
 *
 * ## Unknown is a real answer
 *
 * `state` on a dealership is free text somebody typed into an onboarding form.
 * It can be misspelt, abbreviated, or a state this list does not know. So the
 * lookup is normalised — case, spacing and punctuation folded — and returns
 * `null` rather than a guess when nothing matches. The state header renders
 * without a plate in that case: no code is better than a wrong one on something
 * shaped like a number plate.
 */
const CODES: Record<string, string> = {
  'andhra pradesh': 'AP',
  'arunachal pradesh': 'AR',
  assam: 'AS',
  bihar: 'BR',
  chhattisgarh: 'CG',
  goa: 'GA',
  gujarat: 'GJ',
  haryana: 'HR',
  'himachal pradesh': 'HP',
  jharkhand: 'JH',
  karnataka: 'KA',
  kerala: 'KL',
  'madhya pradesh': 'MP',
  maharashtra: 'MH',
  manipur: 'MN',
  meghalaya: 'ML',
  mizoram: 'MZ',
  nagaland: 'NL',
  odisha: 'OD',
  orissa: 'OD',
  punjab: 'PB',
  rajasthan: 'RJ',
  sikkim: 'SK',
  'tamil nadu': 'TN',
  tamilnadu: 'TN',
  telangana: 'TS',
  tripura: 'TR',
  'uttar pradesh': 'UP',
  uttarakhand: 'UK',
  'west bengal': 'WB',

  // Union territories.
  'andaman and nicobar islands': 'AN',
  chandigarh: 'CH',
  'dadra and nagar haveli and daman and diu': 'DD',
  delhi: 'DL',
  'nct of delhi': 'DL',
  'new delhi': 'DL',
  'jammu and kashmir': 'JK',
  ladakh: 'LA',
  lakshadweep: 'LD',
  puducherry: 'PY',
  pondicherry: 'PY',
};

/** Folds case, punctuation and repeated spaces, so `TAMIL-NADU` still matches. */
function normalise(state: string): string {
  return state
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

/** `Tamil Nadu` → `TN`, and `null` for anything this list does not recognise. */
export function stateCode(state: string | null): string | null {
  if (!state) return null;
  return CODES[normalise(state)] ?? null;
}
