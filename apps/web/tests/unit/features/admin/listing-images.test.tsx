import type { AdminVehicleImage, AdminVehicleImages } from '@dealers-drive/contracts';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ListingImages } from '@/features/admin/listing-images';
import { moved } from '@/features/admin/listing-images/utils';

const presign = vi.fn();
const commit = vi.fn();
const replace = vi.fn();
const remove = vi.fn();

vi.mock('@/features/admin/listing-actions', () => ({
  presignListingImageAction: (...args: unknown[]) => presign(...args) as unknown,
  commitListingImageAction: (...args: unknown[]) => commit(...args) as unknown,
  removeListingImageAction: (...args: unknown[]) => remove(...args) as unknown,
  replaceListingImageAction: (...args: unknown[]) => replace(...args) as unknown,
  reorderListingImagesAction: vi.fn(),
  setPrimaryImageAction: vi.fn(),
}));

const LISTING_ID = '11111111-1111-4111-8111-111111111111';

function image(position: number): AdminVehicleImage {
  return {
    mediaId: `00000000-0000-4000-8000-${String(position).padStart(12, '0')}`,
    position,
    isPrimary: position === 0,
    url: `https://storage.test/private?key=${String(position)}`,
    fileName: `car-${String(position + 1)}.jpg`,
    mimeType: 'image/jpeg',
    bytes: 100,
    width: null,
    height: null,
    uploadedAt: '2026-09-26T10:00:00.000Z',
  };
}

function images(count: number, overrides: Partial<AdminVehicleImages> = {}): AdminVehicleImages {
  return {
    items: Array.from({ length: count }, (_, position) => image(position)),
    min: 6,
    max: 20,
    canEdit: true,
    ...overrides,
  };
}

function jpeg(name: string, bytes = 100): File {
  return new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' });
}

function choose(files: File[]): void {
  fireEvent.change(screen.getByLabelText('Choose processed images to upload'), {
    target: { files },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
  presign.mockResolvedValue({
    ok: true,
    upload: {
      mediaId: '99999999-9999-4999-8999-999999999999',
      uploadUrl: 'https://storage.test/uploads?signed',
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      expiresInSeconds: 900,
    },
  });
  commit.mockResolvedValue({ ok: true });
  replace.mockResolvedValue({ ok: true });
  remove.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  presign.mockReset();
  commit.mockReset();
  replace.mockReset();
  remove.mockReset();
  fetchMock.mockReset();
});

describe('the gallery', () => {
  it('shows each image in order, marks the primary, and offers removal', () => {
    render(<ListingImages listingId={LISTING_ID} images={images(3)} />);

    const tiles = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(tiles).toHaveLength(3);
    expect(within(tiles[0]!).getByText('Primary')).toBeInTheDocument();
    expect(within(tiles[1]!).queryByText('Primary')).not.toBeInTheDocument();
    expect(screen.getByAltText('Image 1, the primary image')).toHaveAttribute(
      'src',
      'https://storage.test/private?key=0',
    );
    expect(screen.getByRole('button', { name: 'Remove image 2' })).toBeInTheDocument();
    expect(screen.getByText('3 uploaded · 6 needed to approve · 20 at most')).toBeInTheDocument();
  });

  it('offers to move each image earlier or later, sending the whole new order', () => {
    render(<ListingImages listingId={LISTING_ID} images={images(3)} />);
    const ids = images(3).items.map((item) => item.mediaId);

    expect(screen.queryByRole('button', { name: 'Move image 1 earlier' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Move image 3 later' })).not.toBeInTheDocument();

    const later = screen.getByRole('button', { name: 'Move image 1 later' });
    const form = later.closest('form');
    expect(form).not.toBeNull();
    expect(new FormData(form!).get('order')).toBe([ids[1], ids[0], ids[2]].join(','));

    const earlier = screen.getByRole('button', { name: 'Move image 3 earlier' });
    expect(new FormData(earlier.closest('form')!).get('order')).toBe(
      [ids[0], ids[2], ids[1]].join(','),
    );
  });

  it('offers to make any image but the primary the primary', () => {
    render(<ListingImages listingId={LISTING_ID} images={images(3)} />);
    expect(
      screen.queryByRole('button', { name: 'Make image 1 the primary image' }),
    ).not.toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Make image 2 the primary image' });
    expect(new FormData(button.closest('form')!).get('mediaId')).toBe(image(1).mediaId);
  });

  it('says how many more are needed before approval', () => {
    render(<ListingImages listingId={LISTING_ID} images={images(5)} />);
    expect(
      screen.getByText('1 more image is needed before this listing can be approved.'),
    ).toBeInTheDocument();
  });

  it('says nothing about the minimum once it is met', () => {
    render(<ListingImages listingId={LISTING_ID} images={images(6)} />);
    expect(screen.queryByText(/needed before this listing/)).not.toBeInTheDocument();
  });

  it('explains the workflow before any image is uploaded', () => {
    render(<ListingImages listingId={LISTING_ID} images={images(0)} />);
    expect(screen.getByText(/upload the processed StudioCar images here/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload images' })).toBeInTheDocument();
  });

  it('offers no upload once the vehicle carries the most it can', () => {
    render(<ListingImages listingId={LISTING_ID} images={images(20)} />);
    expect(screen.queryByRole('button', { name: 'Upload images' })).not.toBeInTheDocument();
    expect(screen.getByText(/already has 20 images/)).toBeInTheDocument();
  });

  it('is read-only once the listing is out of review', () => {
    render(<ListingImages listingId={LISTING_ID} images={images(3, { canEdit: false })} />);
    expect(
      screen.queryByRole('button', { name: /Remove|Replace|Upload|Move|primary/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/only be changed while the listing is in review/)).toBeInTheDocument();
  });
});

describe('uploading', () => {
  it('presigns, puts the bytes to storage and commits each file', async () => {
    render(<ListingImages listingId={LISTING_ID} images={images(0)} />);
    choose([jpeg('front.jpg'), jpeg('rear.jpg')]);

    await waitFor(() => expect(commit).toHaveBeenCalledTimes(2));
    expect(presign).toHaveBeenCalledWith(LISTING_ID, {
      fileName: 'front.jpg',
      mimeType: 'image/jpeg',
      bytes: 100,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://storage.test/uploads?signed',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(commit).toHaveBeenCalledWith(LISTING_ID, '99999999-9999-4999-8999-999999999999');
    expect(commit).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('refuses a file that is not an image before asking the API', async () => {
    render(<ListingImages listingId={LISTING_ID} images={images(0)} />);
    choose([new File(['x'], 'notes.pdf', { type: 'application/pdf' })]);

    expect(
      await screen.findByText('notes.pdf is not a JPEG, PNG or WebP image.'),
    ).toBeInTheDocument();
    expect(presign).not.toHaveBeenCalled();
  });

  it('uploads only what fits and says so', async () => {
    render(<ListingImages listingId={LISTING_ID} images={images(19)} />);
    choose([jpeg('a.jpg'), jpeg('b.jpg')]);

    expect(
      await screen.findByText('Only 1 more image fits; the rest were not uploaded.'),
    ).toBeInTheDocument();
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('reports each file the API or storage refused, and carries on with the rest', async () => {
    presign.mockResolvedValueOnce({ ok: false, message: 'The listing is no longer in review.' });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
    commit.mockResolvedValueOnce({ ok: false, message: 'That file is not a JPEG.' });
    render(<ListingImages listingId={LISTING_ID} images={images(0)} />);
    choose([jpeg('one.jpg'), jpeg('two.jpg'), jpeg('three.jpg'), jpeg('four.jpg')]);

    expect(
      await screen.findByText('one.jpg: The listing is no longer in review.'),
    ).toBeInTheDocument();
    expect(screen.getByText('two.jpg: The upload was rejected by storage.')).toBeInTheDocument();
    expect(screen.getByText('three.jpg: That file is not a JPEG.')).toBeInTheDocument();
    expect(screen.queryByText(/four\.jpg/)).not.toBeInTheDocument();
    expect(commit).toHaveBeenCalledTimes(2);
  });

  it('reports a presign that came back without a media id', async () => {
    presign.mockResolvedValueOnce({
      ok: true,
      upload: { uploadUrl: 'x', method: 'PUT', headers: {}, expiresInSeconds: 1 },
    });
    render(<ListingImages listingId={LISTING_ID} images={images(0)} />);
    choose([jpeg('odd.jpg')]);

    expect(await screen.findByText('odd.jpg: storage refused the upload')).toBeInTheDocument();
  });
});

describe('moved', () => {
  it('moves one id a step either way and refuses to fall off either end', () => {
    expect(moved(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moved(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moved(['a', 'b', 'c'], 0, -1)).toBeNull();
    expect(moved(['a', 'b', 'c'], 2, 1)).toBeNull();
  });
});

describe('live editing', () => {
  it('shows live guidance rather than approval instructions', () => {
    render(<ListingImages listingId={LISTING_ID} images={images(6)} live />);
    expect(screen.getByText('6 uploaded · 6 minimum · 20 at most')).toBeInTheDocument();
    expect(screen.getByText(/Changes appear on the live listing/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace image 1' })).toBeInTheDocument();
  });

  it('replaces a photo even when the gallery is full', async () => {
    render(<ListingImages listingId={LISTING_ID} images={images(20)} live />);
    fireEvent.click(screen.getByRole('button', { name: 'Replace image 1' }));
    fireEvent.change(screen.getByLabelText('Choose a replacement image'), {
      target: { files: [jpeg('new.jpg')] },
    });
    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
    expect(presign).toHaveBeenCalledWith(LISTING_ID, {
      fileName: 'new.jpg',
      mimeType: 'image/jpeg',
      bytes: 100,
      replacesMediaId: image(0).mediaId,
    });
    expect(replace).toHaveBeenCalledWith(
      LISTING_ID,
      image(0).mediaId,
      '99999999-9999-4999-8999-999999999999',
    );
    expect(commit).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('reports replacement validation errors without removing the old photo', async () => {
    replace.mockResolvedValue({ ok: false, message: 'The uploaded file is not an image.' });
    render(<ListingImages listingId={LISTING_ID} images={images(6)} live />);
    fireEvent.click(screen.getByRole('button', { name: 'Replace image 1' }));
    fireEvent.change(screen.getByLabelText('Choose a replacement image'), {
      target: { files: [jpeg('bad.jpg')] },
    });
    expect(
      await screen.findByText('bad.jpg: The uploaded file is not an image.'),
    ).toBeInTheDocument();
    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByAltText('Image 1, the primary image')).toBeInTheDocument();
  });

  it('shows a refused deletion instead of silently ignoring it', async () => {
    remove.mockResolvedValue({
      ok: false,
      message: 'A live listing must keep at least 6 images. Replace an image instead.',
    });
    render(<ListingImages listingId={LISTING_ID} images={images(6)} live />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove image 1' }));
    expect(
      await screen.findByText(/A live listing must keep at least 6 images/),
    ).toBeInTheDocument();
    const form = remove.mock.calls[0]![0] as FormData;
    expect(form.get('mediaId')).toBe(image(0).mediaId);
    expect(form.get('listingId')).toBe(LISTING_ID);
  });

  it('hides editing controls during a replacement upload', async () => {
    let finish!: (value: unknown) => void;
    replace.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<ListingImages listingId={LISTING_ID} images={images(20)} live />);
    fireEvent.click(screen.getByRole('button', { name: 'Replace image 1' }));
    fireEvent.change(screen.getByLabelText('Choose a replacement image'), {
      target: { files: [jpeg('new.jpg')] },
    });
    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: 'Remove image 1' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Uploading 1 of 1');
    finish({ ok: true });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove image 1' })).toBeInTheDocument(),
    );
  });
});
