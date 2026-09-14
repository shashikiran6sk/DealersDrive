import type { FooterLink } from './customer-footer.types';

/**
 * The buyer sections, in the header's order. One list rather than three JSX
 * blocks, so "does the footer agree with the header" is a question somebody can
 * answer by reading eight lines.
 */
export const BUYER_LINKS: FooterLink[] = [
  { href: '/cars', label: 'Buy cars' },
  { href: '/dealers', label: 'Dealer directory' },
  { href: '/saved', label: 'Saved cars' },
];

/**
 * One door, and it is `/dealer` (**R35**). The console decides between "sign in"
 * and "finish onboarding" from the session, so neither header nor footer has to
 * guess which a visitor needs — and therefore neither can get it wrong.
 */
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
