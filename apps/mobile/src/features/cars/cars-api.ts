import {
  CarSuggestResponse,
  PublicLocations,
  PublicVehicleDetail,
  PublicVehiclesResponse,
  SimilarVehiclesResponse,
  PublicVehicleQuery,
  VehicleSlugParam,
} from '@dealers-drive/contracts/public';
import {
  searchHref,
  setParam,
  type VehicleSearchParams,
} from '@dealers-drive/contracts/vehicle-search';
import { createApiClient } from '../../services/api';
import { publicEnvironment } from '../../services/environment';

export function createCarsApi(
  client = createApiClient({ baseUrl: publicEnvironment().apiBaseUrl }),
) {
  return {
    list: (params: VehicleSearchParams, page = 1, signal?: AbortSignal) => {
      const query = setParam(params, 'page', String(page));
      PublicVehicleQuery.parse(query);
      return client.get(searchHref('/v1/vehicles', query), PublicVehiclesResponse, signal);
    },
    locations: (signal?: AbortSignal) => client.get('/v1/locations', PublicLocations, signal),
    detail: (slug: string, signal?: AbortSignal) => {
      VehicleSlugParam.parse({ slug });
      return client.get(`/v1/vehicles/${encodeURIComponent(slug)}`, PublicVehicleDetail, signal);
    },
    similar: (slug: string, signal?: AbortSignal) => {
      VehicleSlugParam.parse({ slug });
      return client.get(
        `/v1/vehicles/${encodeURIComponent(slug)}/similar`,
        SimilarVehiclesResponse,
        signal,
      );
    },
    suggest: (params: VehicleSearchParams, search: string, signal?: AbortSignal) => {
      const query = new URLSearchParams({ search });
      for (const key of ['district', 'city', 'dealer']) {
        const value =
          key === 'district' ? params.district : key === 'city' ? params.city : params.dealer;
        if (value) query.set(key, value);
      }
      return client.get(`/v1/search/vehicles?${query.toString()}`, CarSuggestResponse, signal);
    },
  };
}
export const carsApi = createCarsApi();
