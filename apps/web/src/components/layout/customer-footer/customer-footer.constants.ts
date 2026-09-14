import type { FooterLink } from './customer-footer.types';

export const BUYER_LINKS: FooterLink[] = [
  { href: '/cars', label: 'Buy cars' },
  { href: '/dealers', label: 'Dealer directory' },
  { href: '/saved', label: 'Saved cars' },
];

export const DEALER_LINKS: FooterLink[] = [{ href: '/dealer', label: 'Dealer login' }];

export const FOOTER_TEXT = {
  brand: 'Dealers-Drive',
  trust:
    'Dealers-Drive verifies dealer identity and business documents. Every vehicle is owned, priced and warranted by the dealer who lists it.',
  buyColumn: 'Buy a car',
  dealerColumn: 'For dealers',
  supportColumn: 'Support',
  dealerNote: 'Identity and business documents are checked before a dealership can list.',
  disclaimer:
    'A marketplace for verified independent dealers. Dealers-Drive is not a party to any sale.',
  socialNavLabel: 'Dealers-Drive on social media',
  copyright: (year: number) => `© ${String(year)} Dealers-Drive`,
  socialLinkLabel: (label: string) => `Dealers-Drive on ${label}`,
} as const;
