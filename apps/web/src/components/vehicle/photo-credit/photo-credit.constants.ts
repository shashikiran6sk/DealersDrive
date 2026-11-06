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

export const PHOTO_STANDARD_TEXT = {
  summary: 'Our photo standard',
  points: [
    'Every required angle: front and rear three-quarter, both sides, the dashboard and odometer, front and rear seats, the boot and the engine bay.',
    'The car in this listing — never a stock or catalogue picture.',
    'Sharp, well lit and showing the whole car, with no filters or edits that hide wear or damage.',
  ],
  advice:
    'Photographs help you shortlist. We always recommend seeing the car in person before you buy.',
} as const;
