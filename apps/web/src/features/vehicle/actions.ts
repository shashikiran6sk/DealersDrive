'use server';

import {
  CreateVehicleInput,
  MarkSoldInput,
  ReorderMediaInput,
  UpdateVehicleInput,
  type DealerVehicleDto,
  type MarkSoldResponse,
  type RemoveListingResponse,
  type RenewListingResponse,
  type SubmitListingResponse,
} from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';

/**
 * The dealer's vehicle lifecycle, as Server Actions (C7–C14).
 *
 * No call here carries a `dealerId`; ownership is the API's to resolve from the
 * session, and a vehicle id belonging to another dealer comes back 404 rather
 * than being edited (Rule 1). Nor does anything here set a listing status —
 * `submit`, `mark sold` and `renew` are events, and the state machine decides
 * what they mean (Rule 5).
 */
export interface ActionResult<T = undefined> {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  data?: T;
}

function fail(error: unknown, fallback: string): ActionResult<never> {
  if (error instanceof ApiError) {
    const fieldErrors = error.fieldErrors();
    return {
      ok: false,
      message: error.userMessage(error.problem.title),
      ...(Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
    };
  }
  return { ok: false, message: fallback };
}

function refreshConsole(): void {
  revalidatePath('/dealer', 'layout');
}

/** C7 — creates the DRAFT. Only the basics; everything else is a later PATCH. */
export async function createVehicleAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateVehicleInput.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string') fieldErrors[key] ??= issue.message;
    }
    return { ok: false, fieldErrors, message: 'Check the highlighted fields.' };
  }

  try {
    const vehicle = await apiSend<DealerVehicleDto>(
      'POST',
      '/v1/dealer/vehicles',
      parsed.data,
    );
    refreshConsole();
    return { ok: true, data: { id: vehicle.id } };
  } catch (error) {
    return fail(error, 'We could not create that vehicle.');
  }
}

/** C8 — the wizard's every other step, and the edit screen. */
export async function updateVehicleAction(
  vehicleId: string,
  input: unknown,
): Promise<ActionResult<DealerVehicleDto>> {
  const parsed = UpdateVehicleInput.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string') fieldErrors[key] ??= issue.message;
    }
    return { ok: false, fieldErrors, message: 'Check the highlighted fields.' };
  }

  try {
    const vehicle = await apiSend<DealerVehicleDto>(
      'PATCH',
      `/v1/dealer/vehicles/${vehicleId}`,
      parsed.data,
    );
    refreshConsole();
    return { ok: true, data: vehicle };
  } catch (error) {
    return fail(error, 'We could not save those changes.');
  }
}

/**
 * C11 — submit for approval. This is the moment a credit is **held**: the API
 * writes the `HOLD_SUBMIT` movement in the same transaction as the state
 * change, so a dealer can never end up with a pending listing and no ledger row
 * (Rule 4, ARCHITECTURE §9.2).
 */
export async function submitListingAction(
  vehicleId: string,
): Promise<ActionResult<SubmitListingResponse>> {
  try {
    const result = await apiSend<SubmitListingResponse>(
      'POST',
      `/v1/dealer/vehicles/${vehicleId}/submit`,
    );
    refreshConsole();
    return { ok: true, data: result };
  } catch (error) {
    return fail(error, 'We could not submit that listing.');
  }
}

/**
 * C12 — mark sold.
 *
 * The car stays on the marketplace, badged and inert: visible in search as
 * proof the dealer moves stock, but with no detail page and no way to enquire.
 * `removeListingAction` below is the one that takes it down.
 */
export async function markSoldAction(
  vehicleId: string,
  input: unknown,
): Promise<ActionResult<MarkSoldResponse>> {
  const parsed = MarkSoldInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'That is not a sale we can record.' };

  try {
    const result = await apiSend<MarkSoldResponse>(
      'POST',
      `/v1/dealer/vehicles/${vehicleId}/mark-sold`,
      parsed.data,
    );
    refreshConsole();
    return { ok: true, data: result };
  } catch (error) {
    return fail(error, 'We could not mark that vehicle sold.');
  }
}

/**
 * C12b — withdraw the listing from the marketplace.
 *
 * Not `deleteVehicleAction`: this ends the *publication* and keeps the vehicle,
 * which returns to the inventory as an editable draft. The listing row and its
 * ledger entries survive as the record that this car was once advertised.
 */
export async function removeListingAction(
  vehicleId: string,
): Promise<ActionResult<RemoveListingResponse>> {
  try {
    const result = await apiSend<RemoveListingResponse>(
      'POST',
      `/v1/dealer/vehicles/${vehicleId}/remove-listing`,
    );
    refreshConsole();
    return { ok: true, data: result };
  } catch (error) {
    return fail(error, 'We could not remove that listing.');
  }
}

/** C13 — renew an expiring listing. Costs a credit, so it is never automatic. */
export async function renewListingAction(
  listingId: string,
): Promise<ActionResult<RenewListingResponse>> {
  try {
    const result = await apiSend<RenewListingResponse>(
      'POST',
      `/v1/dealer/listings/${listingId}/renew`,
    );
    refreshConsole();
    return { ok: true, data: result };
  } catch (error) {
    return fail(error, 'We could not renew that listing.');
  }
}

/** C10 — soft delete. 409s while a listing is live; sell or remove it first. */
export async function deleteVehicleAction(vehicleId: string): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/v1/dealer/vehicles/${vehicleId}`);
    refreshConsole();
    return { ok: true };
  } catch (error) {
    return fail(error, 'We could not delete that vehicle.');
  }
}

/** C14 — the **full** ordered array, always. Position 0 becomes PRIMARY. */
export async function reorderMediaAction(
  vehicleId: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = ReorderMediaInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'That photo order is not valid.' };

  try {
    await apiSend('PUT', `/v1/dealer/vehicles/${vehicleId}/media/order`, parsed.data);
    refreshConsole();
    return { ok: true };
  } catch (error) {
    return fail(error, 'We could not reorder those photos.');
  }
}

export async function deleteMediaAction(mediaId: string): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/v1/dealer/media/${mediaId}`);
    refreshConsole();
    return { ok: true };
  } catch (error) {
    return fail(error, 'We could not remove that photo.');
  }
}
