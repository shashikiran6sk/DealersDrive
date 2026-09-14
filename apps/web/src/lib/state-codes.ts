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

function normalise(state: string): string {
  return state
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

export function stateCode(state: string | null): string | null {
  if (!state) return null;
  return CODES[normalise(state)] ?? null;
}
