import { z } from 'zod';
import { Uuid } from './common.js';

export const CustomerDeletionRequestInput = z
  .object({
    confirmed: z.literal(true),
    message: z.string().trim().max(4000).default(''),
    clientRequestId: Uuid,
    expectedAccountId: Uuid,
  })
  .strict();

export const CustomerAccountStatus = z.object({ canDeactivate: z.boolean() });
export type CustomerAccountStatus = z.infer<typeof CustomerAccountStatus>;
export const CustomerDeactivationInput = z.object({ confirmed: z.literal(true) }).strict();
export const CustomerDeactivationReceipt = z.object({ deactivated: z.literal(true) });
export const CustomerReactivationInput = z
  .object({ reactivationToken: z.string().min(1).max(2048), confirmed: z.literal(true) })
  .strict();
export type CustomerReactivationInput = z.infer<typeof CustomerReactivationInput>;

export const CUSTOMER_ACCOUNT_TEXT = Object.freeze({
  reactivate: 'Reactivate customer account and sign in',
  deactivatedAccount: 'Your customer account is deactivated.',
  restart: 'Start verification again',
  privacy: 'Privacy Policy',
  appName: 'Dealers-Drive',
  deletionMetaTitle: 'Dealers-Drive account deletion request',
  externalInstructions:
    'For help without signing in, email customer support with the deletion-request subject. Identify your registered mobile number so we can verify the request. Never send an OTP or password.',
  contactUnavailable:
    'Customer contact details are temporarily unavailable. Open Contact & support or try again later.',
  changedAccount:
    'Your signed-in account has changed. Refresh this page and review your choice again.',
  title: 'Account controls',
  deactivate: 'Temporarily deactivate customer account',
  deactivateBody:
    'Customer access will pause and all customer sessions will be signed out. Saved cars, enquiries, support and legal records are retained. Future dealership sharing will be withdrawn; information already received cannot be recalled. Dealer and staff roles remain unchanged.',
  confirmDeactivate: 'I understand and want to deactivate my customer account.',
  freshOtp: 'Verify your mobile number again',
  freshOtpBody:
    'Deactivation requires customer OTP authentication within the last ten minutes. After verification, return here and confirm the action.',
  deactivated: 'Customer account deactivated',
  reactivationBody:
    'You can reactivate after verifying your mobile number and explicitly confirming. Withdrawn sharing permissions will not be restored.',
  delete: 'Request account deletion',
  deletionBody:
    'This sends a verified account-deletion request to Dealers-Drive support. Your account has not been deleted when the request is sent. We may verify your identity and need to preserve records required by law or a dispute. Support will contact you with next steps.',
  deletionConfirm: 'I want to request deletion of my customer account and associated data.',
  deletionSubject: 'Customer account deletion request',
  deletionDescription:
    'I request deletion of my customer account and associated customer data. Please verify my identity, explain any necessary retention and confirm when the request has been fulfilled.',
  deletionMessage: 'Additional details (optional)',
  deletionReceived: (reference: string) =>
    `Deletion request received: ${reference}. This is a request receipt, not confirmation that your account or data has been deleted.`,
  deletionPending: 'Check My support requests for verification and follow-up.',
  external: 'Request deletion on the website',
  withoutAccount:
    'If you cannot sign in, the website also offers a contact path for deletion requests. You do not need the Android app to use it.',
  records:
    'Deactivation retains your records. Use the separate deletion request if you want data removal.',
  failed: 'The account request could not be completed.',
  uncertain:
    'The result could not be confirmed. Sign in again to check customer access; deactivated accounts require explicit reactivation.',
  back: 'Back',
  agree: 'Make the required choice before continuing.',
  requests: 'My support requests',
});
