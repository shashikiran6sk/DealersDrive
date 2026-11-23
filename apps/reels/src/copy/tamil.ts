export const TAMIL_MONTHS = [
  'ஜனவரி',
  'பிப்ரவரி',
  'மார்ச்',
  'ஏப்ரல்',
  'மே',
  'ஜூன்',
  'ஜூலை',
  'ஆகஸ்ட்',
  'செப்டம்பர்',
  'அக்டோபர்',
  'நவம்பர்',
  'டிசம்பர்',
] as const;

export const ENGLISH_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export const TAMIL_PLACES: Readonly<Record<string, string>> = {
  'tamil nadu': 'தமிழ்நாடு',
  vellore: 'வேலூர்',
  katpadi: 'காட்பாடி',
  ranipet: 'ராணிப்பேட்டை',
  arcot: 'ஆற்காடு',
  walajapet: 'வாலாஜாபேட்டை',
  arakkonam: 'அரக்கோணம்',
  gudiyatham: 'குடியாத்தம்',
  ambur: 'ஆம்பூர்',
  vaniyambadi: 'வாணியம்பாடி',
  tirupattur: 'திருப்பத்தூர்',
  tiruvannamalai: 'திருவண்ணாமலை',
  krishnagiri: 'கிருஷ்ணகிரி',
  kanchipuram: 'காஞ்சிபுரம்',
  chennai: 'சென்னை',
  coimbatore: 'கோயம்புத்தூர்',
  madurai: 'மதுரை',
  salem: 'சேலம்',
  tiruchirappalli: 'திருச்சிராப்பள்ளி',
  trichy: 'திருச்சி',
  erode: 'ஈரோடு',
  tirunelveli: 'திருநெல்வேலி',
  thanjavur: 'தஞ்சாவூர்',
  hosur: 'ஓசூர்',
};

export const TAMIL_FUEL: Readonly<Record<string, string>> = {
  petrol: 'பெட்ரோல்',
  diesel: 'டீசல்',
  cng: 'சிஎன்ஜி',
  electric: 'மின்சாரம்',
  hybrid: 'ஹைப்ரிட்',
  lpg: 'எல்பிஜி',
};

export const TAMIL_TRANSMISSION: Readonly<Record<string, string>> = {
  manual: 'மேனுவல்',
  automatic: 'ஆட்டோமேட்டிக்',
};

export type ServiceTranslation = {
  match: string;
  en: string;
  ta: string;
};

export const SERVICE_TRANSLATIONS: readonly ServiceTranslation[] = [
  { match: 'rctransfer', en: 'RC Transfer', ta: 'RC மாற்றம்' },
  { match: 'buying', en: 'Buying', ta: 'கார் வாங்குதல்' },
  { match: 'selling', en: 'Selling', ta: 'கார் விற்பனை' },
  { match: 'loan', en: 'Loan', ta: 'கடன் வசதி' },
  { match: 'finance', en: 'Finance', ta: 'நிதி உதவி' },
  { match: 'exchange', en: 'Exchange', ta: 'எக்ஸ்சேஞ்ச்' },
  { match: 'insurance', en: 'Insurance', ta: 'காப்பீடு' },
  { match: 'workshop', en: 'Workshop', ta: 'வொர்க்ஷாப்' },
  { match: 'service', en: 'Service', ta: 'சர்வீஸ்' },
];

export const TAMIL_KM = 'கி.மீ';
