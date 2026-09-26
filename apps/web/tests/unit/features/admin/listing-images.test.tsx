import type { AdminVehicleImage, AdminVehicleImages } from '@dealers-drive/contracts';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ListingImages } from '@/features/admin/listing-images';

const presign = vi.fn();
const commit = vi.fn();

vi.mock('@/features/admin/listing-actions', () => ({
  presignListingImageAction: (...args: unknown[]) => presign(...args) as unknown,
  commitListingImageAction: (...args: unknown[]) => commit(...args) as unknown,
  removeListingImageAction: vi.fn(),
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
});

afterEach(() => {
  vi.unstubAllGlobals();
  presign.mockReset();
  commit.mockReset();
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
    expect(screen.queryByRole('button', { name: /Remove|Upload/ })).not.toBeInTheDocument();
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
