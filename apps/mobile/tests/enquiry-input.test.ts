import type { LegalPublication } from '@dealers-drive/contracts/native-auth';
import { ENQUIRY_NOTICE_VERSION } from '@dealers-drive/contracts';
import { SHARING_COPY_NOTICE_VERSION } from '../src/features/enquiries/enquiries.constants';
import {
  enquiryInput,
  sharingSignature,
  enquiryCarSlug,
} from '../src/features/enquiries/enquiry-input';

const publication: LegalPublication = {
  state: 'DRAFT',
  collectionEnabled: true,
  documents: [],
  sharing: { version: SHARING_COPY_NOTICE_VERSION, digest: 'hash', text: 'Notice' },
};
const dealer = {
  required: true,
  recipientId: '11111111-1111-4111-8111-111111111111',
  dealerName: 'Dealer One',
};
it('requires affirmative permission for a new dealership and reuses server-confirmed existing permission', () => {
  expect(() => enquiryInput('car-one', '', false, publication, dealer)).toThrow('Choose whether');
  expect(enquiryInput('car-one', ' hello ', true, publication, dealer)).toEqual({
    listingSlug: 'car-one',
    message: 'hello',
    recipientId: dealer.recipientId,
    sharing: { version: SHARING_COPY_NOTICE_VERSION, granted: true },
  });
  expect(enquiryInput('car-two', '', false, publication, { ...dealer, required: false })).toEqual({
    listingSlug: 'car-two',
    message: undefined,
    recipientId: dealer.recipientId,
  });
});
it('omits collection fields only when server collection is inactive and fails when publication is unavailable', () => {
  expect(
    enquiryInput(
      'car-one',
      '',
      false,
      { ...publication, collectionEnabled: false },
      { ...dealer, required: false },
    ),
  ).toEqual({ listingSlug: 'car-one', message: undefined });
  expect(() =>
    enquiryInput('car-one', '', true, { ...publication, state: 'UNAVAILABLE' }, dealer),
  ).toThrow();
});
it('invalidates a choice for changed receiver, requirement, publication or notice digest', () => {
  const signature = sharingSignature(publication, dealer);
  expect(
    sharingSignature(publication, {
      ...dealer,
      recipientId: '22222222-2222-4222-8222-222222222222',
    }),
  ).not.toBe(signature);
  expect(sharingSignature(publication, { ...dealer, required: false })).not.toBe(signature);
  expect(
    sharingSignature(
      {
        ...publication,
        sharing: { version: SHARING_COPY_NOTICE_VERSION, text: 'Notice', digest: 'changed' },
      },
      dealer,
    ),
  ).not.toBe(signature);
});
it('only follows canonical car paths from enquiry responses', () => {
  expect(enquiryCarSlug('/car/car-one')).toBe('car-one');
  for (const href of [
    null,
    'https://evil.example/car/car-one',
    '//evil.example',
    '/admin',
    '/car/../admin',
    '/car/car-one?token=x',
  ])
    expect(enquiryCarSlug(href)).toBeNull();
});

it('pins the in-app consent copy to the sharing notice version it was written for', () => {
  expect(SHARING_COPY_NOTICE_VERSION).toBe(ENQUIRY_NOTICE_VERSION);
});
it('refuses to record consent to a notice version this build has not shown', () => {
  const newer = {
    ...publication,
    sharing: { version: '3.0', digest: 'hash', text: 'Notice v3' },
  };
  expect(() => enquiryInput('car-one', '', true, newer, dealer)).toThrow(
    'Update the Dealers-Drive app',
  );
  expect(enquiryInput('car-two', '', false, newer, { ...dealer, required: false })).toEqual({
    listingSlug: 'car-two',
    message: undefined,
    recipientId: dealer.recipientId,
  });
});
