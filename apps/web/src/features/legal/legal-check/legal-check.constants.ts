export const LEGAL_CHECK_TEXT = {
  account: 'I agree to the ',
  dealer: 'I am authorized to represent this dealership and agree to the ',
  certification:
    'I confirm authority, accuracy and material disclosures for this vehicle and authorize agreed image uses under the ',
  terms: 'Terms & Conditions',
  acknowledge: ' and acknowledge the ',
  privacy: 'Privacy Policy',
  period: '.',
  dealership: 'identified dealership',
  sharing: (dealer: string) =>
    `I permit sharing my name, verified mobile number and submitted enquiry messages with ${dealer} so it can respond to my enquiries. `,
  sharingDetails: 'Sharing details and withdrawal',
} as const;
