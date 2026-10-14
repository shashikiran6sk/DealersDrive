import type { LegalPublication } from '@dealers-drive/contracts/native-auth';
import {
  enquiryInput,
  sharingSignature,
  enquiryCarSlug,
} from '../src/features/enquiries/enquiry-input';

const publication: LegalPublication = {
  state: 'DRAFT',
  collectionEnabled: true,
  documents: [],
  sharing: { version: 'test-v1', digest: 'hash', text: 'Notice' },
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
    sharing: { version: 'test-v1', granted: true },
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
      { ...publication, sharing: { version: 'test-v1', text: 'Notice', digest: 'changed' } },
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
