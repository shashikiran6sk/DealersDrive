'use server';

import { ServiceLocationsResponse } from '@dealers-drive/contracts';
import { apiGetParsed } from '@/lib/api';

export async function loadServiceLocationsAction() {
  return apiGetParsed(ServiceLocationsResponse, '/v1/service-locations', { revalidate: false });
}
