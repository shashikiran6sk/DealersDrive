import { ApiError } from '../../services/api';
import { API_MESSAGES } from '../../services/api/api.constants';
import {
  SavedVehiclesResponse,
  SavedVehicleSlugs,
  SavedState,
} from '@dealers-drive/contracts/saved';
import { LegalStatus, LegalHistory } from '@dealers-drive/contracts/legal-client';
import type { NativeCustomerSignUpInput } from '@dealers-drive/contracts/native-auth';
import { createApiClient } from '../../services/api';
import { publicEnvironment } from '../../services/environment';

export function createSavedApi(
  client = createApiClient({ baseUrl: publicEnvironment().apiBaseUrl }),
) {
  return {
    list: (token: string, cursor?: string, signal?: AbortSignal) => {
      const query = new URLSearchParams({ limit: '24' });
      if (cursor) query.set('cursor', cursor);
      return client.customer(
        `/v1/saved-vehicles?${query}`,
        SavedVehiclesResponse,
        token,
        {},
        signal,
      );
    },
    slugs: (token: string, cursor?: string, signal?: AbortSignal) => {
      const query = new URLSearchParams({ limit: '500' });
      if (cursor) query.set('cursor', cursor);
      return client.customer(
        `/v1/saved-vehicles/slugs?${query}`,
        SavedVehicleSlugs.required({ page: true }),
        token,
        {},
        signal,
      );
    },
    set: (token: string, slug: string, saved: boolean) =>
      client.customer(`/v1/saved-vehicles/${encodeURIComponent(slug)}`, SavedState, token, {
        method: saved ? 'PUT' : 'DELETE',
      }),
    legalStatus: (token: string, signal?: AbortSignal) =>
      client.customer('/v1/legal/customer/status', LegalStatus, token, {}, signal),
    history: (token: string, signal?: AbortSignal) =>
      client.customer('/v1/legal/customer/history', LegalHistory, token, {}, signal),
    accept: (token: string, agreement: NonNullable<NativeCustomerSignUpInput['agreement']>) =>
      client.customer('/v1/legal/customer/terms', LegalStatus, token, {
        method: 'POST',
        body: agreement,
      }),
  };
}
export const savedApi = createSavedApi();
export async function hydrateSavedSlugs(
  token: string,
  signal: AbortSignal,
  api: Pick<ReturnType<typeof createSavedApi>, 'slugs'> = savedApi,
): Promise<string[]> {
  const slugs = new Set<string>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await api.slugs(token, cursor, signal);
    if (signal.aborted) throw new ApiError('REQUEST_CANCELLED', API_MESSAGES.cancelled);
    for (const slug of page.slugs) slugs.add(slug);
    if (!page.page.hasMore) return [...slugs];
    const next = page.page.nextCursor;
    if (!next || cursors.has(next))
      throw new ApiError('INVALID_RESPONSE', API_MESSAGES.invalidResponse);
    cursors.add(next);
    cursor = next;
  } while (!signal.aborted);
  throw new ApiError('REQUEST_CANCELLED', API_MESSAGES.cancelled);
}
