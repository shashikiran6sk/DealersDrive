import { z } from 'zod';
import {
  CreateEnquiryInput,
  CustomerEnquiry,
  CustomerEnquiriesResponse,
  EnquiryReceipt,
} from '@dealers-drive/contracts/enquiry-client';
import { SharingStatus, SharingPermissions } from '@dealers-drive/contracts/legal-client';
import { createApiClient } from '../../services/api';
import { publicEnvironment } from '../../services/environment';

const Withdrawal = z.object({ withdrawn: z.literal(true) });
export function createEnquiriesApi(
  client = createApiClient({ baseUrl: publicEnvironment().apiBaseUrl }),
) {
  return {
    sharing: (token: string, slug: string, signal?: AbortSignal) =>
      client.customer(
        `/v1/enquiries/sharing-status?${new URLSearchParams({ listingSlug: slug })}`,
        SharingStatus,
        token,
        {},
        signal,
      ),
    create: (token: string, input: CreateEnquiryInput) =>
      client.customer('/v1/enquiries', EnquiryReceipt, token, {
        method: 'POST',
        body: CreateEnquiryInput.parse(input),
      }),
    list: (token: string, cursor?: string, signal?: AbortSignal) => {
      const params = new URLSearchParams({ limit: '20' });
      if (cursor) params.set('cursor', cursor);
      return client.customer(
        `/v1/enquiries?${params}`,
        CustomerEnquiriesResponse,
        token,
        {},
        signal,
      );
    },
    one: (token: string, id: string, signal?: AbortSignal) =>
      client.customer(
        `/v1/enquiries/${encodeURIComponent(id)}`,
        CustomerEnquiry,
        token,
        {},
        signal,
      ),
    permissions: (token: string, signal?: AbortSignal) =>
      client.customer('/v1/enquiries/sharing-permissions', SharingPermissions, token, {}, signal),
    withdraw: (token: string, id: string, grant: boolean) =>
      client.customer(
        grant
          ? `/v1/enquiries/sharing-permissions/${encodeURIComponent(id)}/withdraw`
          : `/v1/enquiries/${encodeURIComponent(id)}/withdraw-sharing`,
        Withdrawal,
        token,
        { method: 'POST' },
      ),
  };
}
export const enquiriesApi = createEnquiriesApi();
