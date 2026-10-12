'use server';

import {
  AddServiceDistrictInput,
  ServiceLocationSettings,
  type ServiceLocationsResponse,
} from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';
import { ApiError, apiSend } from '@/lib/api';

export interface ServiceLocationResult {
  ok: boolean;
  data?: ServiceLocationsResponse;
  message?: string;
}
export async function updateServiceLocationAction(
  kind: 'state' | 'district',
  id: string,
  input: unknown,
): Promise<ServiceLocationResult> {
  const parsed = ServiceLocationSettings.safeParse(input);
  if (!parsed.success || !['state', 'district'].includes(kind))
    return { ok: false, message: 'Check the location settings.' };
  try {
    const data = await apiSend<ServiceLocationsResponse>(
      'PUT',
      `/v1/admin/service-locations/${kind}/${encodeURIComponent(id)}`,
      parsed.data,
    );
    revalidatePath('/admin/config');
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof ApiError ? error.userMessage() : 'Could not save service locations.',
    };
  }
}
export async function addServiceDistrictAction(input: unknown): Promise<ServiceLocationResult> {
  const parsed = AddServiceDistrictInput.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message:
        'Enter the canonical district name and an HTTPS government source, and confirm your review.',
    };
  try {
    const data = await apiSend<ServiceLocationsResponse>(
      'POST',
      '/v1/admin/service-locations/districts',
      parsed.data,
    );
    revalidatePath('/admin/config');
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof ApiError ? error.userMessage() : 'Could not add the district.',
    };
  }
}
