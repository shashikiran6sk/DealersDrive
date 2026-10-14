import {
  CreateSupportTicketInput,
  CustomerSupportTicket,
  CustomerSupportTicketsResponse,
  SupportMessageInput,
} from '@dealers-drive/contracts/support-client';
import { createApiClient } from '../../services/api';
import { publicEnvironment } from '../../services/environment';

export function createSupportApi(
  client = createApiClient({ baseUrl: publicEnvironment().apiBaseUrl }),
) {
  return {
    list: (token: string, cursor?: string, signal?: AbortSignal) => {
      const params = new URLSearchParams({ limit: '20' });
      if (cursor) params.set('cursor', cursor);
      return client.customer(
        `/v1/support/tickets?${params}`,
        CustomerSupportTicketsResponse,
        token,
        {},
        signal,
      );
    },
    one: (token: string, id: string, signal?: AbortSignal) =>
      client.customer(
        `/v1/support/tickets/${encodeURIComponent(id)}`,
        CustomerSupportTicket,
        token,
        {},
        signal,
      ),
    create: (token: string, input: CreateSupportTicketInput) =>
      client.customer('/v1/support/tickets', CustomerSupportTicket, token, {
        method: 'POST',
        body: CreateSupportTicketInput.parse(input),
      }),
    reply: (token: string, id: string, input: SupportMessageInput) =>
      client.customer(
        `/v1/support/tickets/${encodeURIComponent(id)}/messages`,
        CustomerSupportTicket,
        token,
        { method: 'POST', body: SupportMessageInput.parse(input) },
      ),
    reopen: (token: string, id: string) =>
      client.customer(
        `/v1/support/tickets/${encodeURIComponent(id)}/reopen`,
        CustomerSupportTicket,
        token,
        { method: 'POST' },
      ),
  };
}
export const supportApi = createSupportApi();
