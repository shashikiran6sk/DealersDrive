'use server';

import {
  IdParam,
  ListingLifecycleAction,
  RequestReactivationInput,
  WithdrawListingInput,
  type DealerVehicle,
} from '@dealers-drive/contracts';
import { revalidatePath, revalidateTag } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';
import { revalidatePublicDealer, revalidatePublicVehicles, vehicleTag } from '@/lib/cache-tags';

import {
  DASHBOARD_PATH,
  INVENTORY_PATH,
  LIFECYCLE_PATHS,
  LIFECYCLE_TEXT,
  vehicleEditPath,
} from './listing-lifecycle.constants';
import type { LifecycleResult } from './listing-lifecycle.types';

function bodyOf(action: ListingLifecycleAction, payload: unknown) {
  if (action === 'withdraw') return WithdrawListingInput.safeParse(payload);
  if (action === 'requestReactivation') return RequestReactivationInput.safeParse(payload ?? {});
  return null;
}

export async function listingLifecycleAction(
  vehicleId: string,
  action: string,
  payload?: unknown,
): Promise<LifecycleResult> {
  const id = IdParam.safeParse({ id: vehicleId });
  const move = ListingLifecycleAction.safeParse(action);
  if (!id.success || !move.success) return { ok: false, message: LIFECYCLE_TEXT.invalid };

  const body = bodyOf(move.data, payload);
  if (body && !body.success) {
    return {
      ok: false,
      message: move.data === 'withdraw' ? LIFECYCLE_TEXT.reasonRequired : LIFECYCLE_TEXT.invalid,
    };
  }

  let vehicle: DealerVehicle;
  try {
    vehicle = await apiSend<DealerVehicle>(
      'POST',
      `/v1/dealer/vehicles/${encodeURIComponent(id.data.id)}/${LIFECYCLE_PATHS[move.data]}`,
      body?.data,
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: error.userMessage(LIFECYCLE_TEXT.failed) };
    }
    return { ok: false, message: LIFECYCLE_TEXT.unavailable };
  }

  revalidatePath(INVENTORY_PATH);
  revalidatePath(DASHBOARD_PATH);
  revalidatePath(vehicleEditPath(id.data.id));
  revalidatePublicVehicles();
  revalidatePublicDealer();
  if (vehicle.listing.slug) revalidateTag(vehicleTag(vehicle.listing.slug));
  return { ok: true };
}
