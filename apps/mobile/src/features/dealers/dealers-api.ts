import {
  DealerDirectoryQuery,
  DealerDirectoryResponse,
  DealerPublicProfile,
  DealerSuggestResponse,
  DealerVehicleQuery,
  PublicVehiclesResponse,
  PublicConfig,
} from '@dealers-drive/contracts/public';
import { SlugParam } from '@dealers-drive/contracts/common';
import { searchHref, type VehicleSearchParams } from '@dealers-drive/contracts/vehicle-search';
import { createApiClient } from '../../services/api';
import { publicEnvironment } from '../../services/environment';

export interface DirectoryParams {
  district?: string;
  city?: string;
  q?: string;
}
export function createDealersApi(
  client = createApiClient({ baseUrl: publicEnvironment().apiBaseUrl }),
) {
  return {
    directory: (params: DirectoryParams, page = 1, signal?: AbortSignal) => {
      const query = DealerDirectoryQuery.parse({ ...params, page });
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(query))
        if (value !== undefined) search.set(key, String(value));
      return client.get(`/v1/dealers?${search.toString()}`, DealerDirectoryResponse, signal);
    },
    profile: (slug: string, signal?: AbortSignal) => {
      SlugParam.parse({ slug });
      return client.get(`/v1/dealers/${encodeURIComponent(slug)}`, DealerPublicProfile, signal);
    },
    inventory: (slug: string, params: VehicleSearchParams, page = 1, signal?: AbortSignal) => {
      SlugParam.parse({ slug });
      const scoped = Object.fromEntries(
        Object.entries(params).filter(([key]) => !['district', 'city', 'dealer'].includes(key)),
      );
      DealerVehicleQuery.parse({ ...scoped, page });
      return client.get(
        searchHref(`/v1/dealers/${encodeURIComponent(slug)}/vehicles`, {
          ...scoped,
          page: String(page),
        }),
        PublicVehiclesResponse,
        signal,
      );
    },
    suggest: (params: DirectoryParams, search: string, signal?: AbortSignal) => {
      const query = new URLSearchParams({ search });
      if (params.district) query.set('district', params.district);
      if (params.city) query.set('city', params.city);
      return client.get(`/v1/search/dealers?${query.toString()}`, DealerSuggestResponse, signal);
    },
    config: (signal?: AbortSignal) => client.get('/v1/config/public', PublicConfig, signal),
    home: (params: VehicleSearchParams, signal?: AbortSignal) => {
      const path = searchHref('/v1/vehicles', params);
      return client.get(
        `${path}${path.includes('?') ? '&' : '?'}limit=4`,
        PublicVehiclesResponse,
        signal,
      );
    },
  };
}
export const dealersApi = createDealersApi();
