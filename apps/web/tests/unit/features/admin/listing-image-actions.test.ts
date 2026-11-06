import { afterEach, describe, expect, it, vi } from 'vitest';

import { revalidations } from '../../../setup.js';
import {
  commitListingImageAction,
  presignListingImageAction,
  removeListingImageAction,
  reorderListingImagesAction,
  replaceListingImageAction,
  setImageCreditAction,
  setPrimaryImageAction,
} from '../../../../src/features/admin/listing-actions.js';

const ID = '11111111-1111-4111-8111-111111111111';
const MEDIA = '22222222-2222-4222-8222-222222222222';
const NEW = '33333333-3333-4333-8333-333333333333';
const ORIGINAL_FETCH = globalThis.fetch;

function form() {
  const data = new FormData();
  data.set('listingId', ID);
  data.set('mediaId', MEDIA);
  data.set('order', MEDIA);
  return data;
}

function creditForm(credit: string) {
  const data = form();
  data.set('credit', credit);
  return data;
}

function respond(status = 200) {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            status === 200
              ? {}
              : { code: 'VEHICLE_IMAGES_MINIMUM', title: 'Conflict', detail: 'Keep 6 photos.' },
          ),
          { status },
        ),
      ),
    );
  globalThis.fetch = fetch;
  return fetch;
}

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('image actions', () => {
  it.each([
    ['commit', () => commitListingImageAction(ID, MEDIA, 'DEALER')],
    ['replace', () => replaceListingImageAction(ID, MEDIA, NEW)],
    ['remove', () => removeListingImageAction(form())],
    ['reorder', () => reorderListingImagesAction(form())],
    ['primary', () => setPrimaryImageAction(form())],
    ['credit', () => setImageCreditAction(creditForm('DEALER'))],
  ] as const)('invalidates cached public galleries after %s', async (_name, action) => {
    respond();
    await action();
    expect(revalidations.tags).toContain('vehicles');
    expect(revalidations.paths).toContain(`/admin/listings/${ID}`);
  });

  it('sends who took the photograph at commit and when correcting it', async () => {
    const fetch = respond();
    expect(await commitListingImageAction(ID, MEDIA, 'DEALER')).toEqual({ ok: true });
    expect(fetch.mock.calls[0]![0]).toContain(`/images/${MEDIA}/commit`);
    expect(JSON.parse(fetch.mock.calls[0]![1]?.body as string)).toEqual({ credit: 'DEALER' });

    await setImageCreditAction(creditForm('DEALERS_DRIVE'));
    expect(fetch.mock.calls[1]![0]).toContain(`/images/${MEDIA}/credit`);
    expect(fetch.mock.calls[1]![1]?.method).toBe('PUT');
    expect(JSON.parse(fetch.mock.calls[1]![1]?.body as string)).toEqual({
      credit: 'DEALERS_DRIVE',
    });
  });

  it('sends no correction for an unknown photographer or a malformed id', async () => {
    const fetch = respond();
    await setImageCreditAction(creditForm('STUDIO'));
    const bad = creditForm('DEALER');
    bad.set('mediaId', '../../dealer');
    await setImageCreditAction(bad);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('turns an unreachable API into an error on correction, but not a refusal', async () => {
    globalThis.fetch = vi.fn<typeof fetch>().mockRejectedValue(new Error('down'));
    await expect(setImageCreditAction(creditForm('DEALER'))).rejects.toThrow(/unavailable/);
    respond(409);
    await expect(setImageCreditAction(creditForm('DEALER'))).resolves.toBeUndefined();
  });

  it('sends replacement intent at presign and the new media ID at replace', async () => {
    const fetch = respond();
    await presignListingImageAction(ID, {
      fileName: 'new.jpg',
      mimeType: 'image/jpeg',
      bytes: 20,
      replacesMediaId: MEDIA,
    });
    expect(JSON.parse(fetch.mock.calls[0]![1]?.body as string)).toMatchObject({
      replacesMediaId: MEDIA,
    });
    expect(await replaceListingImageAction(ID, MEDIA, NEW)).toEqual({ ok: true });
    expect(fetch.mock.calls[1]![0]).toContain(`/images/${MEDIA}/replace`);
    expect(JSON.parse(fetch.mock.calls[1]![1]?.body as string)).toEqual({
      replacementMediaId: NEW,
    });
  });

  it.each([
    ['commit', () => commitListingImageAction(ID, MEDIA, 'DEALER')],
    ['replace', () => replaceListingImageAction(ID, MEDIA, NEW)],
    ['remove', () => removeListingImageAction(form())],
  ] as const)(
    'returns API errors for %s without invalidating public caches',
    async (_name, action) => {
      respond(409);
      expect(await action()).toMatchObject({ ok: false, message: 'Keep 6 photos.' });
      expect(revalidations.tags).not.toContain('vehicles');
    },
  );

  it('rejects malformed replacement IDs without making a request', async () => {
    const fetch = respond();
    expect(await replaceListingImageAction(ID, MEDIA, 'bad')).toMatchObject({ ok: false });
    expect(fetch).not.toHaveBeenCalled();
  });
});
