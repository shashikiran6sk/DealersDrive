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
