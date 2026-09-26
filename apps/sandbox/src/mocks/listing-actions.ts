export interface ListingActionResult {
  ok: boolean;
  message?: string;
}

export const listingActionsStub: { calls: Record<string, string>[] } = { calls: [] };

export async function setListingCheckAction(formData: FormData): Promise<void> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') values[key] = value;
  }
  listingActionsStub.calls.push(values);
  await new Promise((resolve) => setTimeout(resolve, 300));
}

export async function setPhotographyAction(formData: FormData): Promise<void> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') values[key] = value;
  }
  listingActionsStub.calls.push(values);
  await new Promise((resolve) => setTimeout(resolve, 300));
}

export async function requestListingChangesAction(
  _listingId: string,
  _reason: string,
): Promise<ListingActionResult> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return { ok: true };
}

export async function rejectListingAction(
  _listingId: string,
  _reason: string,
): Promise<ListingActionResult> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return { ok: false, message: 'This listing changed while you were looking at it.' };
}
