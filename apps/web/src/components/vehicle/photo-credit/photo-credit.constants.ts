import type { PhotoCreditSummary } from '@dealers-drive/contracts';

export interface PhotoCreditCopy {
  title: string | null;
  body: string;
}

export const PHOTO_CREDIT_COPY: Record<
  PhotoCreditSummary | 'UNRECORDED',
  (dealerName: string) => PhotoCreditCopy
> = {
  DEALERS_DRIVE: () => ({
    title: 'Photographed by Dealers-Drive',
    body: 'Taken by our team at the dealership.',
  }),
  DEALER: (dealerName) => ({
    title: 'Dealer photos · Reviewed by Dealers-Drive',
    body: `Supplied by ${dealerName} and checked against our photo standard.`,
  }),
  MIXED: (dealerName) => ({
    title: `Photos by Dealers-Drive and ${dealerName}`,
    body: 'Every photograph is checked against our photo standard.',
  }),
  UNRECORDED: () => ({
    title: null,
    body: 'Every photograph is checked against the Dealers-Drive photo standard.',
  }),
};
