export const AUDIENCE_TEXT = {
  eyebrow: 'Built for both sides',
  title: 'A marketplace where the dealer stays the dealer',
  body: 'Dealers-Drive helps buyers discover trustworthy local businesses and gives independent dealerships a professional place to present who they are.',
} as const;

export const AUDIENCE_CARDS = [
  {
    key: 'buyers',
    eyebrow: 'For buyers',
    title: 'Know who you are buying from',
    body: 'Start with verified dealer profiles and cars reviewed before they go live, then enquire about a car directly with the dealership that owns it.',
    href: '/dealers',
    link: 'Browse the dealer directory →',
  },
  {
    key: 'dealers',
    eyebrow: 'For dealers',
    title: 'Build a trusted digital presence',
    body: 'Join the verified network, manage your dealership profile and get ready to showcase inventory to serious local buyers.',
    href: '/dealer',
    link: 'Open the dealer console →',
  },
] as const;
