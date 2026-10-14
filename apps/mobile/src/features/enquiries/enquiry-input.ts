import { CreateEnquiryInput } from '@dealers-drive/contracts/enquiry-client';
import type { SharingStatus } from '@dealers-drive/contracts/legal-client';
import type { LegalPublication } from '@dealers-drive/contracts/native-auth';
import { ApiError } from '../../services/api';
import { ENQUIRY_TEXT } from './enquiries.constants';

export function sharingSignature(
  publication: LegalPublication,
  status: typeof SharingStatus._output,
): string {
  return JSON.stringify([
    publication.state,
    publication.collectionEnabled,
    publication.sharing?.version,
    publication.sharing?.digest,
    status.recipientId,
    status.required,
  ]);
}
export function enquiryInput(
  slug: string,
  message: string,
  granted: boolean,
  publication: LegalPublication,
  status: typeof SharingStatus._output,
): CreateEnquiryInput {
  if (
    publication.state === 'UNAVAILABLE' ||
    (publication.collectionEnabled && !publication.sharing)
  )
    throw new ApiError('LEGAL_UNAVAILABLE', ENQUIRY_TEXT.failed);
  if (publication.collectionEnabled && status.required && !granted)
    throw new ApiError('ENQUIRY_PERMISSION_REQUIRED', ENQUIRY_TEXT.choose);
  return CreateEnquiryInput.parse({
    listingSlug: slug,
    message,
    ...(publication.collectionEnabled
      ? {
          recipientId: status.recipientId,
          ...(status.required
            ? { sharing: { version: publication.sharing?.version, granted: true } }
            : {}),
        }
      : {}),
  });
}
export function enquiryCarSlug(href: string | null): string | null {
  if (!href) return null;
  const match = /^\/car\/([A-Za-z0-9-]{1,200})$/.exec(href);
  return match?.[1] ?? null;
}
