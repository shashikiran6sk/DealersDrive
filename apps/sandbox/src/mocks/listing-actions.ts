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

export type ImagePresignResult =
  | {
      ok: true;
      upload: {
        mediaId?: string;
        uploadUrl: string;
        method: 'PUT';
        headers: Record<string, string>;
        expiresInSeconds: number;
      };
    }
  | { ok: false; message: string };

export async function presignListingImageAction(
  _listingId: string,
  file: { fileName: string; mimeType: string; bytes: number },
): Promise<ImagePresignResult> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (file.fileName.includes('fail')) {
    return { ok: false, message: 'This vehicle already has 20 images.' };
  }
  return {
    ok: true,
    upload: {
      mediaId: '00000000-0000-4000-8000-0000000000aa',
      uploadUrl: 'data:,',
      method: 'PUT',
      headers: {},
      expiresInSeconds: 900,
    },
  };
}

export async function commitListingImageAction(
  _listingId: string,
  _mediaId: string,
): Promise<ListingActionResult> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return { ok: true };
}

export async function removeListingImageAction(formData: FormData): Promise<void> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') values[key] = value;
  }
  listingActionsStub.calls.push(values);
  await new Promise((resolve) => setTimeout(resolve, 300));
}
